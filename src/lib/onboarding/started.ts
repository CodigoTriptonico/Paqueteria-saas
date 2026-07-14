const STORAGE_PREFIX = "boxario:onboarding-started:";

function storageKey(organizationId: string) {
  return `${STORAGE_PREFIX}${organizationId}`;
}

export function isOnboardingStartedLocally(organizationId: string) {
  if (typeof window === "undefined" || !organizationId) {
    return false;
  }

  return window.localStorage.getItem(storageKey(organizationId)) === "1";
}

export function markOnboardingStartedLocally(organizationId: string) {
  if (typeof window === "undefined" || !organizationId) {
    return;
  }

  window.localStorage.setItem(storageKey(organizationId), "1");
}

export function clearOnboardingStartedLocally(organizationId: string) {
  if (typeof window === "undefined" || !organizationId) {
    return;
  }

  window.localStorage.removeItem(storageKey(organizationId));
}

export function mergeOnboardingStarted(
  organizationId: string | null | undefined,
  startedFromServer: boolean,
  options?: { allowLocalStart?: boolean },
) {
  if (!organizationId) {
    return startedFromServer;
  }

  if (startedFromServer) {
    return true;
  }

  if (options?.allowLocalStart && isOnboardingStartedLocally(organizationId)) {
    return true;
  }

  if (isOnboardingStartedLocally(organizationId)) {
    clearOnboardingStartedLocally(organizationId);
  }

  return false;
}
