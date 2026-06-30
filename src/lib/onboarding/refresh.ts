export const ONBOARDING_PROGRESS_CHANGED = "boxario:onboarding-progress-changed";

export function dispatchOnboardingProgressChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ONBOARDING_PROGRESS_CHANGED));
}
