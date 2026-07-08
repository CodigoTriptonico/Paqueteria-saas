import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDevTunnelOrigins } from "./dev-tunnel-origins";

describe("dev tunnel origins eval", () => {
  it("covers a fresh quick tunnel hostname without editing next.config", () => {
    const origins = resolveDevTunnelOrigins({
      tunnelUrl: "https://fresh-demo-host.trycloudflare.com",
    });
    assert.ok(origins.includes("*.trycloudflare.com"));
    assert.ok(origins.includes("fresh-demo-host.trycloudflare.com"));
  });
});
