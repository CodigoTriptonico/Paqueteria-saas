import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isDevAuthBypassEnabled } from "./dev-auth-bypass";

const originalNodeEnv = process.env.NODE_ENV;
const originalDevAuthBypass = process.env.DEV_AUTH_BYPASS;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalDevAuthBypass === undefined) {
    delete process.env.DEV_AUTH_BYPASS;
  } else {
    process.env.DEV_AUTH_BYPASS = originalDevAuthBypass;
  }
});

describe("isDevAuthBypassEnabled", () => {
  it("never allows bypass in production", () => {
    process.env.NODE_ENV = "production";
    process.env.DEV_AUTH_BYPASS = "1";
    assert.equal(isDevAuthBypassEnabled(), false);
  });

  it("does not allow bypass in development without the flag", () => {
    process.env.NODE_ENV = "development";
    delete process.env.DEV_AUTH_BYPASS;
    assert.equal(isDevAuthBypassEnabled(), false);

    process.env.DEV_AUTH_BYPASS = "0";
    assert.equal(isDevAuthBypassEnabled(), false);
  });

  it("allows bypass in development only when DEV_AUTH_BYPASS=1 on local supabase", () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    assert.equal(isDevAuthBypassEnabled(), true);
  });

  it("blocks bypass when supabase url is not local", () => {
    process.env.NODE_ENV = "development";
    process.env.DEV_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    assert.equal(isDevAuthBypassEnabled(), false);
  });
});
