"use client";

import { Sparkles } from "lucide-react";
import type { OnboardingCoachHint } from "@/lib/onboarding/coach-targets";
import { onboardingCoachCountdownRemainingMs } from "@/lib/onboarding/coach-countdown";
import { useOnboardingCoachState } from "@/components/onboarding/onboarding-coach-context";

function OnboardingCoachCountdownCard({
  hint,
  progress,
  idleMs,
  variant,
}: {
  hint: OnboardingCoachHint;
  progress: number;
  idleMs: number;
  variant: "sidebar" | "rail";
}) {
  const remainingMs = onboardingCoachCountdownRemainingMs(progress * idleMs, idleMs);
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const isRail = variant === "rail";

  return (
    <div
      className={`onboarding-coach-countdown-pill mb-2 w-full ${isRail ? "px-0.5" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Próximo tip del tutorial en ${remainingSeconds} segundos: ${hint.title}`}
    >
      <div
        className={`overflow-hidden rounded-lg border border-emerald-500/35 bg-[#0f1714]/95 shadow-[0_10px_28px_rgba(0,0,0,0.35)] ${
          isRail ? "px-2 py-2" : "px-3 py-2.5"
        }`}
      >
        <div className={`flex items-center ${isRail ? "justify-center" : "gap-2.5"}`}>
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ${
              isRail ? "h-7 w-7" : "h-8 w-8"
            }`}
            title={isRail ? hint.title : undefined}
          >
            <Sparkles className={`${isRail ? "h-3.5 w-3.5" : "h-4 w-4"} animate-pulse`} aria-hidden />
          </span>
          {isRail ? null : (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300/90">
                  Próximo tip
                </p>
                <p className="text-[10px] font-black tabular-nums text-slate-400">
                  {remainingSeconds}s
                </p>
              </div>
              <p className="truncate text-xs font-bold text-slate-200">{hint.title}</p>
            </div>
          )}
        </div>
        <div
          className={`onboarding-coach-countdown-track h-1.5 overflow-hidden rounded-full ${
            isRail ? "mt-2" : "mt-2.5"
          }`}
          aria-hidden
        >
          <div
            className="onboarding-coach-countdown-fill h-full rounded-full"
            style={{
              transform: `scaleX(${Math.max(0.04, progress)})`,
              transformOrigin: "left center",
            }}
          />
        </div>
        {isRail ? (
          <p className="mt-1.5 text-center text-[10px] font-black tabular-nums text-slate-400">
            {remainingSeconds}s
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function OnboardingCoachSidebarCountdown({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "rail";
}) {
  const coach = useOnboardingCoachState();
  const pendingHint = coach?.pendingHint ?? null;
  const countdownProgress = coach?.countdownProgress ?? 0;
  const idleMs = coach?.idleMs ?? 12_000;

  if (
    !pendingHint ||
    countdownProgress <= 0 ||
    countdownProgress >= 1
  ) {
    return null;
  }

  return (
    <OnboardingCoachCountdownCard
      hint={pendingHint}
      progress={countdownProgress}
      idleMs={idleMs}
      variant={variant}
    />
  );
}
