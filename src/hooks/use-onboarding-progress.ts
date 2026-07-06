"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOnboardingProgressAction,
  type OnboardingProgress,
} from "@/app/actions/onboarding";
import { ONBOARDING_PROGRESS_CHANGED } from "@/lib/onboarding/refresh";
import {
  isOnboardingTutorialEnabled,
  onboardingTutorialDisabledProgress,
} from "@/lib/onboarding/feature";

const CACHE_TTL_MS = 60_000;

let cachedProgress: OnboardingProgress | null = null;
let cacheTimestamp = 0;
let inflightRequest: Promise<OnboardingProgress | null> | null = null;

async function fetchOnboardingProgress(force = false): Promise<OnboardingProgress | null> {
  if (!isOnboardingTutorialEnabled()) {
    cachedProgress = onboardingTutorialDisabledProgress();
    cacheTimestamp = Date.now();
    return cachedProgress;
  }

  const cacheFresh = cachedProgress && Date.now() - cacheTimestamp < CACHE_TTL_MS;

  if (!force && cacheFresh) {
    return cachedProgress;
  }

  if (!force && inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = getOnboardingProgressAction()
    .then((result) => {
      const next = result.ok ? result.data : null;
      cachedProgress = next;
      cacheTimestamp = Date.now();
      return next;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}

export function invalidateOnboardingProgressCache() {
  cachedProgress = null;
  cacheTimestamp = 0;
}

export function useOnboardingProgress() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(cachedProgress);
  const [loading, setLoading] = useState(!cachedProgress);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isOnboardingTutorialEnabled()) {
      const disabled = onboardingTutorialDisabledProgress();
      cachedProgress = disabled;
      cacheTimestamp = Date.now();
      setProgress(disabled);
      setLoading(false);
      setError("");
      return disabled;
    }

    setLoading((current) => current || !cachedProgress);
    setError("");

    const result = await getOnboardingProgressAction();

    if (!result.ok) {
      setError(result.error);
      setProgress(null);
      setLoading(false);
      return null;
    }

    cachedProgress = result.data;
    cacheTimestamp = Date.now();
    setProgress(result.data);
    setLoading(false);
    return result.data;
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!isOnboardingTutorialEnabled()) {
        const disabled = onboardingTutorialDisabledProgress();
        cachedProgress = disabled;
        cacheTimestamp = Date.now();
        setProgress(disabled);
        setLoading(false);
        setError("");
        return disabled;
      }

      const cacheFresh = cachedProgress && Date.now() - cacheTimestamp < CACHE_TTL_MS;

      if (!force && cacheFresh) {
        setProgress(cachedProgress);
        setLoading(false);
        setError("");
        return cachedProgress;
      }

      setLoading((current) => current || !cachedProgress);
      setError("");

      try {
        const next = await fetchOnboardingProgress(force);
        setProgress(next);
        return next;
      } catch {
        setError("No se pudo cargar el progreso");
        setProgress(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load(false);
    });

    function onFocus() {
      void load(false);
    }

    function onProgressChanged() {
      invalidateOnboardingProgressCache();
      void load(true);
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED, onProgressChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(ONBOARDING_PROGRESS_CHANGED, onProgressChanged);
    };
  }, [load]);

  const pendingCount =
    progress?.eligible && !progress.allComplete ? progress.pendingCount : 0;

  return { progress, pendingCount, loading, error, refresh, load };
}
