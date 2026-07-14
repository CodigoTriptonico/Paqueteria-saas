import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  onboardingCoachCountdownProgress,
  onboardingCoachCountdownRemainingMs,
} from "@/lib/onboarding/coach-countdown";

describe("onboarding coach countdown", () => {
  it("maps elapsed idle time to progress", () => {
    assert.equal(onboardingCoachCountdownProgress(0, 5_000), 0);
    assert.equal(onboardingCoachCountdownProgress(2_500, 5_000), 0.5);
    assert.equal(onboardingCoachCountdownProgress(5_000, 5_000), 1);
    assert.equal(onboardingCoachCountdownProgress(9_000, 5_000), 1);
  });

  it("computes remaining milliseconds until the next tip", () => {
    assert.equal(onboardingCoachCountdownRemainingMs(0, 5_000), 5_000);
    assert.equal(onboardingCoachCountdownRemainingMs(2_500, 5_000), 2_500);
    assert.equal(onboardingCoachCountdownRemainingMs(5_000, 5_000), 0);
  });
});
