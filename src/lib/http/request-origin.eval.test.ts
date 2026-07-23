import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRequestUrl } from "./request-origin";

describe("request origin eval", () => {
  it("does not trust a quick-tunnel forwarded host unless it is configured", () => {
    const loginUrl = resolveRequestUrl(
      new Request("http://127.0.0.1:3000/api/auth/sign-in", {
        headers: {
          "x-forwarded-host": "dot-petroleum-magnetic-bryant.trycloudflare.com",
          "x-forwarded-proto": "https",
        },
      }),
      "/login?error=Invalid+login+credentials",
    );

    assert.notEqual(loginUrl.hostname, "dot-petroleum-magnetic-bryant.trycloudflare.com");
    assert.equal(loginUrl.pathname, "/login");
    assert.equal(loginUrl.searchParams.get("error"), "Invalid login credentials");
  });

  it("uses an explicitly configured public origin for sign-in redirects", () => {
    const loginUrl = resolveRequestUrl(
      new Request("http://127.0.0.1:3000/api/auth/sign-in"),
      "/login?error=Invalid+login+credentials",
      { tunnelUrl: "https://configured.example", readTunnelFile: false },
    );

    assert.equal(loginUrl.toString(), "https://configured.example/login?error=Invalid+login+credentials");
  });
});
