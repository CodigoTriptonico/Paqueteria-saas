"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOnboardingProgressAction,
  type OnboardingProgress,
} from "@/app/actions/onboarding";
import {
  ONBOARDING_PROGRESS_CHANGED,
} from "@/lib/onboarding/refresh";
import {
  isOnboardingTutorialEnabled,
  onboardingTutorialDisabledProgress,
} from "@/lib/onboarding/feature";
import {
  markOnboardingStartedLocally,
  mergeOnboardingStarted,
} from "@/lib/onboarding/started";

const CACHE_TTL_MS = 60_000;

const pendingOptimisticStart = new Set<string>();

let cachedProgress: OnboardingProgress | null = null;
let cacheTimestamp = 0;
let inflightRequest: Promise<OnboardingProgress | null> | null = null;

function withMergedStarted(
  progress: OnboardingProgress | null,
  organizationId?: string | null,
) {
  if (!progress || !organizationId) {
    return progress;
  }

  return {
    ...progress,
    started: mergeOnboardingStarted(organizationId, progress.started, {
      allowLocalStart: pendingOptimisticStart.has(organizationId),
    }),
  };
}

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

export function optimisticallyStartOnboarding(organizationId: string) {
  pendingOptimisticStart.add(organizationId);
  markOnboardingStartedLocally(organizationId);
}

export function useOnboardingProgress(organizationId?: string | null) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(cachedProgress);
  const [loading, setLoading] = useState(!cachedProgress);
  const [error, setError] = useState("");
  const [localStartedTick, setLocalStartedTick] = useState(0);

  const effectiveProgress = useMemo(() => {
    void localStartedTick;
    return withMergedStarted(progress, organizationId);
  }, [localStartedTick, organizationId, progress]);

  const applyProgress = useCallback(
    (next: OnboardingProgress | null, options?: { fromServer?: boolean }) => {
      if (organizationId && options?.fromServer && next?.started) {
        pendingOptimisticStart.delete(organizationId);
      }

      const merged = withMergedStarted(next, organizationId);
      if (merged) {
        cachedProgress = merged;
        cacheTimestamp = Date.now();
      }
      setProgress(merged);
      return merged;
    },
    [organizationId],
  );

  const refresh = useCallback(async () => {
    if (!isOnboardingTutorialEnabled()) {
      const disabled = onboardingTutorialDisabledProgress();
      return applyProgress(disabled);
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

    setLoading(false);
    return applyProgress(result.data, { fromServer: true });
  }, [applyProgress]);

  const load = useCallback(
    async (force = false, options?: { silent?: boolean }) => {
      if (!isOnboardingTutorialEnabled()) {
        return applyProgress(onboardingTutorialDisabledProgress());
      }

      const cacheFresh = cachedProgress && Date.now() - cacheTimestamp < CACHE_TTL_MS;

      if (!force && cacheFresh) {
        const merged = applyProgress(cachedProgress);
        setLoading(false);
        setError("");
        return merged;
      }

      if (!options?.silent) {
        setLoading((current) => current || !cachedProgress);
      }
      setError("");

      try {
        const next = await fetchOnboardingProgress(force);
        return applyProgress(next, { fromServer: true });
      } catch {
        if (!options?.silent) {
          setError("No se pudo cargar el progreso");
          setProgress(null);
        }
        return null;
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [applyProgress],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void load(false);
    });

    function onFocus() {
      void load(false);
    }

    function onProgressChanged() {
      setLocalStartedTick((current) => current + 1);
      void load(true, { silent: true });
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED, onProgressChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(ONBOARDING_PROGRESS_CHANGED, onProgressChanged);
    };
  }, [applyProgress, load]);

  const pendingCount = useMemo(() => {
    if (!effectiveProgress?.eligible || effectiveProgress.allComplete) {
      return 0;
    }

    if (!effectiveProgress.started) {
      return 1;
    }

    return effectiveProgress.pendingCount;
  }, [effectiveProgress]);

  return { progress: effectiveProgress, pendingCount, loading, error, refresh, load };
}
