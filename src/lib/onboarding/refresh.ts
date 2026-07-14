export const ONBOARDING_PROGRESS_CHANGED = "boxario:onboarding-progress-changed";

export type OnboardingProgressChangedDetail = {
  silent?: boolean;
};

export function dispatchOnboardingProgressChanged(
  detail: OnboardingProgressChangedDetail = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OnboardingProgressChangedDetail>(ONBOARDING_PROGRESS_CHANGED, {
      detail,
    }),
  );
}
