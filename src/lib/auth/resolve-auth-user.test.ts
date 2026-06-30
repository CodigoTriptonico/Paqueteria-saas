import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuthServiceUnavailable, resolveAuthUser } from "@/lib/auth/resolve-auth-user";

describe("isAuthServiceUnavailable", () => {
  it("detects fetch failures with ECONNREFUSED cause", () => {
    assert.equal(
      isAuthServiceUnavailable({
        message: "fetch failed",
        cause: { code: "ECONNREFUSED" },
      }),
      true,
    );
  });

  it("ignores regular auth errors", () => {
    assert.equal(
      isAuthServiceUnavailable({
        message: "Invalid JWT",
      }),
      false,
    );
  });
});

describe("resolveAuthUser", () => {
  it("returns authenticated when Supabase returns a user", async () => {
    const result = await resolveAuthUser(async () => ({
      data: { user: { id: "user-1" } as never },
      error: null,
    }));

    assert.deepEqual(result, {
      status: "authenticated",
      user: { id: "user-1" },
    });
  });

  it("returns unavailable when Supabase cannot be reached", async () => {
    const result = await resolveAuthUser(async () => {
      throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    });

    assert.deepEqual(result, { status: "unavailable" });
  });

  it("returns unauthenticated when there is no active session", async () => {
    const result = await resolveAuthUser(async () => ({
      data: { user: null },
      error: null,
    }));

    assert.deepEqual(result, { status: "unauthenticated" });
  });
});
