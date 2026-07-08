import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isPublicSignupEnabled } from "./public-signup";

const originalNodeEnv = process.env.NODE_ENV;
const originalAllowSignup = process.env.ALLOW_PUBLIC_SIGNUP;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalAllowSignup === undefined) {
    delete process.env.ALLOW_PUBLIC_SIGNUP;
  } else {
    process.env.ALLOW_PUBLIC_SIGNUP = originalAllowSignup;
  }
});

describe("isPublicSignupEnabled", () => {
  it("is always false in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_PUBLIC_SIGNUP = "1";
    assert.equal(isPublicSignupEnabled(), false);
  });

  it("is false in development without ALLOW_PUBLIC_SIGNUP", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_PUBLIC_SIGNUP;
    assert.equal(isPublicSignupEnabled(), false);
  });

  it("is true in development when ALLOW_PUBLIC_SIGNUP=1", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_PUBLIC_SIGNUP = "1";
    assert.equal(isPublicSignupEnabled(), true);
  });
});
