export function onboardingCoachCountdownProgress(
  elapsedMs: number,
  idleMs: number,
): number {
  if (idleMs <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, elapsedMs / idleMs));
}

export function onboardingCoachCountdownRemainingMs(
  elapsedMs: number,
  idleMs: number,
): number {
  return Math.max(0, idleMs - elapsedMs);
}
