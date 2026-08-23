import { z } from "zod";

import { CodexMigrationAgent, ReplayMigrationAgent } from "@/lib/migration/agent";
import { runMigration } from "@/lib/migration/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mode: z.enum(["codex", "replay"]).default("codex"),
});

let activeRun = false;
let lastRunFinishedAt = 0;

function requestIsAuthorized(request: Request) {
  const token = process.env.VERSIONLESS_DEMO_TOKEN;
  if (token && request.headers.get("x-versionless-demo-token") === token) return true;

  const requestUrl = new URL(request.url);
  if (!isLocalHost(requestUrl.hostname)) return false;
  return hasSameOriginEvidence(request, requestUrl);
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
  if (!requestIsAuthorized(request)) {
    return Response.json({ error: "The migration runtime is disabled without a demo token." }, { status: 403 });
  }
  if (activeRun) {
    return Response.json({ error: "One migration is already running." }, { status: 429 });
  }
  if (Date.now() - lastRunFinishedAt < 2_000) {
    return Response.json({ error: "Wait two seconds before starting another migration." }, { status: 429 });
  }

  activeRun = true;
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    activeRun = false;
    return Response.json({ error: "Mode must be either codex or replay." }, { status: 400 });
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

      void runMigration({ agent, onEvent: emit, signal: abortController.signal })
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
