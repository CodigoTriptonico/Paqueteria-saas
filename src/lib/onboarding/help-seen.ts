import type { OnboardingStepId } from "@/app/actions/onboarding";

const STORAGE_KEY = "boxario:onboarding:help-seen";

export const ONBOARDING_HELP_SEEN_CHANGED = "boxario:onboarding-help-seen-changed";

const VALID_STEP_IDS = new Set<OnboardingStepId>([
  "countries",
  "inventory",
  "pricing",
  "stock",
  "first_sale",
]);

function readSeenSet(): Set<OnboardingStepId> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(
      parsed.filter((id): id is OnboardingStepId => VALID_STEP_IDS.has(id as OnboardingStepId)),
    );
  } catch {
    return new Set();
  }
}

export function hasOnboardingHelpSeen(stepId: OnboardingStepId) {
  return readSeenSet().has(stepId);
}

export function markOnboardingHelpSeen(stepId: OnboardingStepId) {
  if (typeof window === "undefined") {
    return;
  }

  const seen = readSeenSet();
  if (seen.has(stepId)) {
    return;
  }

  seen.add(stepId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  window.dispatchEvent(new CustomEvent(ONBOARDING_HELP_SEEN_CHANGED, { detail: { stepId } }));
}
