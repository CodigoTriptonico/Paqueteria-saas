"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { isOnboardingTutorialEnabled } from "@/lib/onboarding/feature";
import {
  ONBOARDING_COACH_IDLE_MS,
  onboardingCoachTargetKeys,
  resolveOnboardingCoachHint,
  type OnboardingCoachHint,
} from "@/lib/onboarding/coach-targets";
import { onboardingCoachCountdownProgress } from "@/lib/onboarding/coach-countdown";
import {
  isOnboardingNotificationsPanelOpen,
  subscribeOnboardingNotificationsPanelOpen,
} from "@/lib/onboarding/notifications-panel";
import { resolveOnboardingGuide } from "@/lib/onboarding/micro-steps";

export function useOnboardingCoach(organizationId?: string | null) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { progress, loading } = useOnboardingProgress(organizationId);
  const [visible, setVisible] = useState(false);
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(
    isOnboardingNotificationsPanelOpen,
  );
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownStartRef = useRef<number | null>(null);
  const hintSignatureRef = useRef("");

  useEffect(
    () =>
      subscribeOnboardingNotificationsPanelOpen(() => {
        setNotificationsPanelOpen(isOnboardingNotificationsPanelOpen());
      }),
    [],
  );

  const guide = useMemo(() => {
    if (
      !isOnboardingTutorialEnabled() ||
      loading ||
      !progress?.eligible ||
      !progress.started ||
      progress.allComplete ||
      progress.dismissed
    ) {
      return null;
    }

    return resolveOnboardingGuide(pathname, searchParams, progress);
  }, [loading, pathname, progress, searchParams]);

  const hint = useMemo(
    () =>
      resolveOnboardingCoachHint(
        guide,
        pathname,
        searchParams,
        progress,
        notificationsPanelOpen,
      ),
    [guide, notificationsPanelOpen, pathname, progress, searchParams],
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetCountdown = useCallback(() => {
    countdownStartRef.current = null;
    setCountdownProgress(0);
  }, []);

  const scheduleIdleShow = useCallback(() => {
    clearIdleTimer();

    if (!hint) {
      resetCountdown();
      return;
    }

    countdownStartRef.current = Date.now();
    setCountdownProgress(0);

    idleTimerRef.current = setTimeout(() => {
      setVisible(true);
      setCountdownProgress(1);
    }, ONBOARDING_COACH_IDLE_MS);
  }, [clearIdleTimer, hint, resetCountdown]);

  const hintSignature = hint
    ? `${onboardingCoachTargetKeys(hint).join("|")}:${hint.title}:${hint.body}:${pathname}:${searchParams.toString()}:${notificationsPanelOpen}`
    : "";

  useEffect(() => {
    if (hintSignature === hintSignatureRef.current) {
      return;
    }

    hintSignatureRef.current = hintSignature;
    const frame = window.requestAnimationFrame(() => {
      setVisible(false);
      scheduleIdleShow();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hintSignature, scheduleIdleShow]);

  useEffect(() => {
    if (!hint) {
      clearIdleTimer();
      const frame = window.requestAnimationFrame(() => {
        setVisible(false);
        resetCountdown();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const frame = window.requestAnimationFrame(scheduleIdleShow);
    return () => {
      window.cancelAnimationFrame(frame);
      clearIdleTimer();
    };
  }, [clearIdleTimer, hint, resetCountdown, scheduleIdleShow]);

  useEffect(() => {
    if (!hint || visible) {
      if (visible) {
        const frame = window.requestAnimationFrame(() => setCountdownProgress(1));
        return () => window.cancelAnimationFrame(frame);
      }

      return;
    }

    let frame = 0;

    function tick() {
      const startedAt = countdownStartRef.current;

      if (!startedAt) {
        setCountdownProgress(0);
        return;
      }

      const progress = onboardingCoachCountdownProgress(
        Date.now() - startedAt,
        ONBOARDING_COACH_IDLE_MS,
      );
      setCountdownProgress(progress);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [hint, hintSignature, visible]);

  useEffect(() => {
    function onCoachTargetClick(event: MouseEvent) {
      const target = event.target as Element | null;

      if (!target?.closest("[data-onboarding-target]")) {
        return;
      }

      // El usuario ya ejecutó la acción indicada. Oculta el tip de inmediato
      // y espera a que cambie el progreso o la pantalla para mostrar el paso
      // siguiente; así no queda flotando sobre formularios inline.
      setVisible(false);
      clearIdleTimer();
      resetCountdown();
    }

    document.addEventListener("click", onCoachTargetClick, true);
    return () => document.removeEventListener("click", onCoachTargetClick, true);
  }, [clearIdleTimer, resetCountdown]);

  const activeHint: OnboardingCoachHint | null =
    visible && hint ? hint : null;
  const pendingHint: OnboardingCoachHint | null =
    hint && !visible ? hint : null;

  return {
    hint: activeHint,
    pendingHint,
    countdownProgress,
    idleMs: ONBOARDING_COACH_IDLE_MS,
    guide,
    notificationsPanelOpen,
  };
}
