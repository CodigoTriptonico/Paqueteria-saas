import type { OnboardingProgress } from "@/app/actions/onboarding";

/** Tutorial de configuración inicial en el panel de notificaciones. */
export const ONBOARDING_TUTORIAL_ENABLED = false;

export function isOnboardingTutorialEnabled() {
  return ONBOARDING_TUTORIAL_ENABLED;
}

export function onboardingTutorialDisabledProgress(): OnboardingProgress {
  return {
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
  };
}
