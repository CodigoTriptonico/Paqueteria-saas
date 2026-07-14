import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearOnboardingStartedLocally,
  isOnboardingStartedLocally,
  markOnboardingStartedLocally,
  mergeOnboardingStarted,
} from "@/lib/onboarding/started";

describe("onboarding started state", () => {
  it("uses server started flag when true", () => {
    assert.equal(mergeOnboardingStarted("org-1", true), true);
  });

  it("clears stale local started when server says false", () => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const orgId = `test-org-${Date.now()}`;

    try {
      markOnboardingStartedLocally(orgId);
      assert.equal(mergeOnboardingStarted(orgId, false), false);
      assert.equal(isOnboardingStartedLocally(orgId), false);
    } finally {
      clearOnboardingStartedLocally(orgId);
    }
  });

  it("keeps local started only while optimistic start is pending", () => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const orgId = `test-org-${Date.now()}`;

    try {
      markOnboardingStartedLocally(orgId);
      assert.equal(
        mergeOnboardingStarted(orgId, false, { allowLocalStart: true }),
        true,
      );
      assert.equal(isOnboardingStartedLocally(orgId), true);
    } finally {
      clearOnboardingStartedLocally(orgId);
    }
  });
});
