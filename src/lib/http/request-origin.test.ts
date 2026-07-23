import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRequestOrigin, resolveRequestUrl } from "./request-origin";

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("resolveRequestOrigin", () => {
  it("ignores an untrusted forwarded host", () => {
    const origin = resolveRequestOrigin(
      makeRequest("http://127.0.0.1:3000/api/auth/sign-in", {
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "https",
      }),
      { readTunnelFile: false },
    );
    assert.equal(origin, "http://127.0.0.1:3000");
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
      { tunnelUrl: "https://demo.trycloudflare.com" },
    );
    assert.equal(url.toString(), "https://demo.trycloudflare.com/platform");
  });
});
