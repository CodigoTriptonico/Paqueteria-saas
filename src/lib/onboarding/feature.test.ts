import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOnboardingTutorialEnabled,
  ONBOARDING_TUTORIAL_ENABLED,
  onboardingTutorialDisabledProgress,
} from "@/lib/onboarding/feature";

describe("onboarding tutorial feature flag", () => {
  it("keeps the tutorial disabled for now", () => {
    assert.equal(ONBOARDING_TUTORIAL_ENABLED, false);
    assert.equal(isOnboardingTutorialEnabled(), false);
  });

  it("returns inert progress while disabled", () => {
    assert.deepEqual(onboardingTutorialDisabledProgress(), {
      eligible: false,
      dismissed: false,
      started: false,
      steps: [],
      completedCount: 0,
      totalCount: 5,
      pendingCount: 0,
      allComplete: false,
      inventoryHasCategory: false,
      inventoryHasItems: false,
      firstCountryName: null,
    });
  });
});
