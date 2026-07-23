import assert from "node:assert/strict";
import test from "node:test";
import { localCredentialGuardError } from "./local-credential-guard.mjs";

test("allows credential scripts only with explicit local development scope", () => {
  assert.equal(
    localCredentialGuardError({
      nodeEnv: "development",
      enabled: "1",
      supabaseUrl: "http://127.0.0.1:55021",
    }),
    null,
  );
});

test("rejects production even when the explicit flag is present", () => {
  assert.match(
    localCredentialGuardError({
      nodeEnv: "production",
      enabled: "1",
      supabaseUrl: "http://127.0.0.1:55021",
    }),
    /NODE_ENV=development/,
  );
});

test("rejects remote Supabase URLs", () => {
  assert.match(
    localCredentialGuardError({
      nodeEnv: "development",
      enabled: "1",
      supabaseUrl: "https://example.supabase.co",
    }),
    /Supabase local/,
  );
});

test("rejects a missing explicit flag", () => {
  assert.match(
    localCredentialGuardError({
      nodeEnv: "development",
      enabled: "0",
      supabaseUrl: "http://localhost:55021",
    }),
    /habilitarse explícitamente/,
  );
});
