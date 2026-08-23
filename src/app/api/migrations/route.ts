import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

import { CodexMigrationAgent, ReplayMigrationAgent } from "@/lib/migration/agent";
import { runMigration } from "@/lib/migration/run";
import { localTarget, warrantTarget } from "@/lib/migration/target";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const relativePathSchema = z.string().trim().min(1).max(240).refine(
  (value) => !value.startsWith("/") && !value.includes("\0") && !value.split("/").includes("..") && !value.startsWith(".git"),
  "Paths must stay inside the selected repository.",
);
const localTargetSchema = z.object({
  type: z.literal("local"),
  repositoryPath: z.string().trim().min(1).max(500).refine((value) => value.startsWith("/"), "Use an absolute repository path."),
  task: z.string().trim().min(12).max(2_000),
  allowedFiles: z.array(relativePathSchema).min(1).max(12),
  lockedPaths: z.array(relativePathSchema).min(1).max(30),
  verificationCommand: z.object({
    executable: z.string().trim().min(1).max(240).regex(/^[A-Za-z0-9_./+-]+$/, "Use an executable path, not a shell command."),
    args: z.array(z.string().max(240)).max(20),
  }),
}).refine(
  (target) => target.allowedFiles.every((allowed) => !target.lockedPaths.some((locked) => allowed === locked || allowed.startsWith(`${locked}/`))),
  { message: "An allowed file cannot be inside a locked path." },
);
const requestSchema = z.object({
  mode: z.enum(["codex", "replay"]).default("codex"),
  target: z.discriminatedUnion("type", [z.object({ type: z.literal("warrant") }), localTargetSchema]).default({ type: "warrant" }),
});

let activeRun = false;
let lastRunFinishedAt = 0;

async function requestIsAuthorized(request: Request) {
  const token = process.env.VERSIONLESS_DEMO_TOKEN;
  if (token && request.headers.get("x-versionless-demo-token") === token) return true;

  const requestUrl = new URL(request.url);
  if (isLocalHost(requestUrl.hostname)) return hasSameOriginEvidence(request, requestUrl);
  const { userId } = await auth();
  return Boolean(userId);
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function hasSameOriginEvidence(request: Request, requestUrl: URL) {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) return secFetchSite === "same-origin" || secFetchSite === "none";

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.protocol === requestUrl.protocol && originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!await requestIsAuthorized(request)) {
    return Response.json({ error: "The migration runtime is disabled without a demo token." }, { status: 403 });
  }
  if (activeRun) {
    return Response.json({ error: "One migration is already running." }, { status: 429 });
  }
  if (Date.now() - lastRunFinishedAt < 2_000) {
    return Response.json({ error: "Wait two seconds before starting another migration." }, { status: 429 });
  }

  activeRun = true;
  let body: unknown;
  try {
    body = await parseRequestBody(request);
  } catch {
    activeRun = false;
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    activeRun = false;
    const modeOnlyFailure = typeof body === "object" && body !== null && "mode" in body && !["codex", "replay"].includes(String(body.mode));
    return Response.json({ error: modeOnlyFailure ? "Mode must be either codex or replay." : "Repository configuration is invalid." }, { status: 400 });
  }
  if (parsed.data.mode === "replay" && parsed.data.target.type !== "warrant") {
    activeRun = false;
    return Response.json({ error: "Replay is available only for the proven Warrant run." }, { status: 422 });
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let closed = false;
  request.signal.addEventListener("abort", () => {
    closed = true;
    abortController.abort();
  }, { once: true });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const agent = parsed.data.mode === "codex" ? new CodexMigrationAgent() : new ReplayMigrationAgent();
      const target = parsed.data.target.type === "warrant" ? warrantTarget() : localTarget(parsed.data.target);

      void runMigration({ agent, onEvent: emit, signal: abortController.signal, target })
        .catch(() => undefined)
        .finally(() => {
          activeRun = false;
          lastRunFinishedAt = Date.now();
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
    },
    cancel() {
      closed = true;
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function parseRequestBody(request: Request): Promise<unknown> {
  if (!request.body) return {};
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as unknown;
}
