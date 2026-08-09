import { describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";

describe("GET /api/health", () => {
  it("returns a standard Worker health response", async () => {
    const response = await createApp().request("http://example.test/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
