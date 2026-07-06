import {
  getConductorTruckInventoryAction,
} from "@/app/actions/conductor-tasks";
import { listRouteMembersAction } from "@/app/actions/shipments";
import { ConductorTruckInventoryClient } from "@/components/conductor/conductor-truck-inventory-client";
import { requirePathAccess } from "@/lib/auth/require";
import {
  canPreviewConductorTasks,
  resolveConductorTasksView,
} from "@/lib/conductor-tareas-view";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ConductorInventarioCamionPage({
  searchParams,
}: {
  searchParams: Promise<{ conductor?: string }>;
}) {
  const session = await requirePathAccess("/conductor/inventario-camion");
  const { conductor: previewDriverId } = await searchParams;
  const roleSlug = session?.roleSlug ?? "vendedor";
  const canPreview = canPreviewConductorTasks(roleSlug);

  let drivers: { id: string; label: string }[] = [];

  if (canPreview && isSupabaseConfigured() && session) {
    const membersResult = await listRouteMembersAction();
    drivers = membersResult.ok ? membersResult.data : [];
  }

  const view = resolveConductorTasksView({
    roleSlug,
    sessionUserId: session?.userId ?? "",
    sessionLabel: session?.fullName || session?.email || "Conductor",
    drivers,
    previewDriverId,
  });

  let initialView = null;
  let initialError = "";

  if (isSupabaseConfigured() && session && view.effectiveDriverId) {
    const result = await getConductorTruckInventoryAction(view.effectiveDriverId);

    if (result.ok) {
      initialView = result.data;
    } else {
      initialError = result.error;
    }
  }

  return (
    <ConductorTruckInventoryClient
      canPreview={view.canPreview}
      drivers={drivers}
      previewDriverId={view.previewDriverId}
      effectiveDriverId={view.effectiveDriverId}
      effectiveDriverLabel={view.effectiveDriverLabel}
      initialView={initialView}
      initialError={initialError}
    />
  );
}
