import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRequestUrl } from "./request-origin";

describe("request origin eval", () => {
  it("avoids localhost redirects for cloudflare quick tunnel sign-in failures", () => {
    const loginUrl = resolveRequestUrl(
      new Request("http://127.0.0.1:3000/api/auth/sign-in", {
        headers: {
          "x-forwarded-host": "dot-petroleum-magnetic-bryant.trycloudflare.com",
          "x-forwarded-proto": "https",
        },
      }),
      "/login?error=Invalid+login+credentials",
    );

    assert.equal(
      loginUrl.toString(),
      "https://dot-petroleum-magnetic-bryant.trycloudflare.com/login?error=Invalid+login+credentials",
    );
  });
});
