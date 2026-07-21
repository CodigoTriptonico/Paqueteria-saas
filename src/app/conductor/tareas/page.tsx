import {
  getConductorTruckInventoryAction,
  getConductorRouteArrivalWorkspaceAction,
  listConductorClosedDriverTasksAction,
  listConductorDriverTasksAction,
} from "@/app/actions/conductor-tasks";
import { listRouteMembersAction } from "@/app/actions/shipments";
import { ConductorTareasClient } from "@/components/conductor/conductor-tareas-client";
import { requirePathAccess } from "@/lib/auth/require";
import {
  canPreviewConductorTasks,
  resolveConductorTasksView,
} from "@/lib/conductor-tareas-view";
import type { ConductorDriverTask } from "@/lib/conductor-tasks";
import type { ConductorTruckInventorySummary } from "@/lib/conductor-truck-inventory";
import type { ConductorRouteArrivalWorkspace } from "@/lib/conductor-route-arrival";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ConductorTareasPage({
  searchParams,
}: {
  searchParams: Promise<{ conductor?: string }>;
}) {
  const session = await requirePathAccess("/conductor/tareas");
  const { conductor: previewDriverId } = await searchParams;
  const roleSlug = session?.roleSlug ?? "vendedor";
  const canPreview = canPreviewConductorTasks(roleSlug);

  let drivers: { id: string; label: string }[] = [];
  let initialTasks: ConductorDriverTask[] = [];
  let initialCompletedTasks: ConductorDriverTask[] = [];
  let initialTruckSummary: ConductorTruckInventorySummary | null = null;
  let initialRouteArrival: ConductorRouteArrivalWorkspace = { routes: [], warehouses: [] };

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

  if (isSupabaseConfigured() && session && view.effectiveDriverId) {
    const [tasksResult, completedResult, truckResult, arrivalResult] = await Promise.all([
      listConductorDriverTasksAction(view.effectiveDriverId),
      listConductorClosedDriverTasksAction(view.effectiveDriverId),
      getConductorTruckInventoryAction(view.effectiveDriverId),
      getConductorRouteArrivalWorkspaceAction(view.effectiveDriverId),
    ]);
    initialTasks = tasksResult.ok ? tasksResult.data : [];
    initialCompletedTasks = completedResult.ok ? completedResult.data : [];
    initialTruckSummary = truckResult.ok ? truckResult.data.summary : null;
    initialRouteArrival = arrivalResult.ok ? arrivalResult.data : initialRouteArrival;
  }

  return (
    <ConductorTareasClient
      canPreview={view.canPreview}
      drivers={drivers}
      previewDriverId={view.previewDriverId}
      effectiveDriverId={view.effectiveDriverId}
      effectiveDriverLabel={view.effectiveDriverLabel}
      organizationId={session?.organizationId ?? ""}
      userId={session?.userId ?? ""}
      initialTasks={initialTasks}
      initialCompletedTasks={initialCompletedTasks}
      initialTruckSummary={initialTruckSummary}
      initialRouteArrival={initialRouteArrival}
      agencyModuleEnabled={session?.agencyModuleEnabled ?? false}
    />
  );
}
