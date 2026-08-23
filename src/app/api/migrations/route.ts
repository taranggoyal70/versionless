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
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  const token = process.env.VERSIONLESS_DEMO_TOKEN;
  return Boolean(token && request.headers.get("x-versionless-demo-token") === token);
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

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Mode must be either codex or replay." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let closed = false;
  activeRun = true;
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
