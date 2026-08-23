import { afterEach, describe, expect, it } from "vitest";

import { POST } from "./route";

const originalDemoToken = process.env.VERSIONLESS_DEMO_TOKEN;

afterEach(() => {
  if (originalDemoToken === undefined) delete process.env.VERSIONLESS_DEMO_TOKEN;
  else process.env.VERSIONLESS_DEMO_TOKEN = originalDemoToken;
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
});
