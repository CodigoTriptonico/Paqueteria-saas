"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useOnboardingCoach } from "@/hooks/use-onboarding-coach";

type OnboardingCoachState = ReturnType<typeof useOnboardingCoach>;

const OnboardingCoachContext = createContext<OnboardingCoachState | null>(null);

export function OnboardingCoachProvider({
  organizationId = null,
  children,
}: {
  organizationId?: string | null;
  children: ReactNode;
}) {
  const value = useOnboardingCoach(organizationId);

  return (
    <OnboardingCoachContext.Provider value={value}>
      {children}
    </OnboardingCoachContext.Provider>
  );
}

export function useOnboardingCoachState() {
  return useContext(OnboardingCoachContext);
}
