import type { OnboardingProgress } from "@/app/actions/onboarding";

/** Pausa el tutorial de configuración inicial hasta el próximo aviso. */
export const ONBOARDING_TUTORIAL_ENABLED = false;

export function isOnboardingTutorialEnabled() {
  return ONBOARDING_TUTORIAL_ENABLED;
}

export function onboardingTutorialDisabledProgress(): OnboardingProgress {
  return {
    eligible: false,
    dismissed: false,
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
