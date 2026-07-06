import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const featureSource = readFileSync(join(root, "lib/onboarding/feature.ts"), "utf8");
const onboardingActionSource = readFileSync(join(root, "app/actions/onboarding.ts"), "utf8");
const onboardingPanelSource = readFileSync(
  join(root, "components/onboarding/onboarding-panel.tsx"),
  "utf8",
);
const notificationsSource = readFileSync(
  join(root, "components/notifications/notifications-center.tsx"),
  "utf8",
);
const progressHookSource = readFileSync(join(root, "hooks/use-onboarding-progress.ts"), "utf8");

describe("onboarding tutorial pause eval", () => {
  it("defines a central feature flag disabled by default", () => {
    assert.match(featureSource, /ONBOARDING_TUTORIAL_ENABLED = false/);
    assert.match(featureSource, /isOnboardingTutorialEnabled/);
  });

  it("short-circuits onboarding progress while disabled", () => {
    assert.match(onboardingActionSource, /isOnboardingTutorialEnabled\(\)/);
    assert.match(onboardingActionSource, /onboardingTutorialDisabledProgress\(\)/);
  });

  it("hides the onboarding panel while disabled", () => {
    assert.match(onboardingPanelSource, /isOnboardingTutorialEnabled\(\)/);
  });

  it("shows a paused tutorial message in notifications", () => {
    assert.match(notificationsSource, /TutorialPausedState/);
    assert.match(notificationsSource, /Tutorial en pausa/);
    assert.match(notificationsSource, /isOnboardingTutorialEnabled\(\)/);
  });

  it("avoids fetching onboarding progress while disabled", () => {
    assert.match(progressHookSource, /isOnboardingTutorialEnabled\(\)/);
    assert.match(progressHookSource, /onboardingTutorialDisabledProgress\(\)/);
  });
});
