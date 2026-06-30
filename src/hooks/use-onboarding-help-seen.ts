"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnboardingStepId } from "@/app/actions/onboarding";
import {
  hasOnboardingHelpSeen,
  markOnboardingHelpSeen,
  ONBOARDING_HELP_SEEN_CHANGED,
} from "@/lib/onboarding/help-seen";

export function useOnboardingHelpSeen(stepId: OnboardingStepId) {
  const [seen, setSeen] = useState(() =>
    typeof window !== "undefined" ? hasOnboardingHelpSeen(stepId) : false,
  );

  useEffect(() => {
    queueMicrotask(() => setSeen(hasOnboardingHelpSeen(stepId)));

    function onChanged(event: Event) {
      const detail = (event as CustomEvent<{ stepId?: OnboardingStepId }>).detail;
      if (!detail?.stepId || detail.stepId === stepId) {
        setSeen(hasOnboardingHelpSeen(stepId));
      }
    }

    window.addEventListener(ONBOARDING_HELP_SEEN_CHANGED, onChanged);
    return () => window.removeEventListener(ONBOARDING_HELP_SEEN_CHANGED, onChanged);
  }, [stepId]);

  const markSeen = useCallback(() => {
    markOnboardingHelpSeen(stepId);
    setSeen(true);
  }, [stepId]);

  return { seen, markSeen };
}
