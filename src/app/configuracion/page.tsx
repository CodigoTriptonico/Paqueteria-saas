import { ConfiguracionClient } from "@/components/configuracion-client";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requirePathAccess } from "@/lib/auth/require";
import { loadTimeClockDashboard, syncTimeClockAlertsForOrganization } from "@/lib/time-clock-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function loadTimeClockInitialSnapshot(
  session: NonNullable<Awaited<ReturnType<typeof requirePathAccess>>>,
  canManage: boolean,
) {
  try {
    if (canManage) {
      await syncTimeClockAlertsForOrganization(session.organizationId);
    }
    return await loadTimeClockDashboard(session);
  } catch {
    return undefined;
  }
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requirePathAccess("/configuracion");
  const { view } = await searchParams;
  const canManageTimeClock = Boolean(session && sessionHasPermission(session, "time_clock.manage"));

  let initialPricing;
  let timeClockInitialSnapshot;

  if (isSupabaseConfigured() && session) {
    if (view === "timeclock") {
      timeClockInitialSnapshot = await loadTimeClockInitialSnapshot(session, canManageTimeClock);
    } else {
      try {
        const { loadPricingConfigForSession } = await import("@/lib/pricing/load-config");
        initialPricing = await loadPricingConfigForSession(session);
      } catch {
        initialPricing = undefined;
      }
    }
  }

  return (
    <ConfiguracionClient
      initialPricing={initialPricing}
      timeClockInitialSnapshot={timeClockInitialSnapshot}
      canManageTimeClock={canManageTimeClock}
      agencyModuleEnabled={session?.agencyModuleEnabled ?? false}
    />
  );
}
