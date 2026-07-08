import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRequestOrigin, resolveRequestUrl } from "./request-origin";

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("resolveRequestOrigin", () => {
  it("prefers x-forwarded-host over localhost request url", () => {
    const origin = resolveRequestOrigin(
      makeRequest("http://127.0.0.1:3000/api/auth/sign-in", {
        "x-forwarded-host": "demo.trycloudflare.com",
        "x-forwarded-proto": "https",
      }),
    );
    assert.equal(origin, "https://demo.trycloudflare.com");
  });

  it("falls back to tunnel url when host is local", () => {
    const origin = resolveRequestOrigin(
      makeRequest("http://localhost:3000/login"),
      { tunnelUrl: "https://demo.trycloudflare.com" },
    );
    assert.equal(origin, "https://demo.trycloudflare.com");
  });

  it("keeps local origin when no tunnel hints exist", () => {
    const origin = resolveRequestOrigin(makeRequest("http://localhost:3000/login"), {
      readTunnelFile: false,
    });
    assert.equal(origin, "http://localhost:3000");
  });
});

describe("resolveRequestUrl", () => {
  it("builds redirect urls on the public tunnel origin", () => {
    const url = resolveRequestUrl(
      makeRequest("http://localhost:3000/api/auth/sign-in", {
        "x-forwarded-host": "demo.trycloudflare.com",
        "x-forwarded-proto": "https",
      }),
      "/platform",
    );
    assert.equal(url.toString(), "https://demo.trycloudflare.com/platform");
  });
});
