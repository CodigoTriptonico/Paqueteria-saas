import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSupabaseAuthCookie } from "@/lib/auth/clear-auth-cookies";

describe("isSupabaseAuthCookie", () => {
  it("selects only Supabase session cookies", () => {
    assert.equal(isSupabaseAuthCookie("sb-local-auth-token"), true);
    assert.equal(isSupabaseAuthCookie("sb-project-auth-token.0"), true);
    assert.equal(isSupabaseAuthCookie("session"), false);
    assert.equal(isSupabaseAuthCookie("x-sb-project"), false);
  });
});
