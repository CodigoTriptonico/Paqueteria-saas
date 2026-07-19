import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPublicProxyPath,
  resolveAuthenticatedLoginPath,
} from "@/lib/auth/proxy-paths";

describe("proxy auth paths", () => {
  it("allows only exact public routes and their real descendants", () => {
    assert.equal(isPublicProxyPath("/login"), true);
    assert.equal(isPublicProxyPath("/rastrear/BOX-123"), true);
    assert.equal(isPublicProxyPath("/api/public/tracking/BOX-123"), true);
    assert.equal(isPublicProxyPath("/login-admin"), false);
    assert.equal(isPublicProxyPath("/api/auth/sign-in-backdoor"), false);
  });

  it("redirects authenticated login visits only to safe internal paths", () => {
    assert.equal(resolveAuthenticatedLoginPath("/login", "/venta?step=box"), "/venta?step=box");
    assert.equal(resolveAuthenticatedLoginPath("/login", "https://evil.example"), "/");
    assert.equal(resolveAuthenticatedLoginPath("/login", "//evil.example"), "/");
    assert.equal(resolveAuthenticatedLoginPath("/rastrear", "/venta"), null);
  });
});
