import { Route, UserRound } from "lucide-react";
import type { ShipmentOperationalAssignment } from "@/lib/shipment-display";

function badgeClass(assigned: boolean, ready: boolean) {
  if (ready) {
    return "border-emerald-600/50 bg-emerald-950/25 text-emerald-200";
  }

  if (assigned) {
    return "border-amber-600/40 bg-amber-950/20 text-amber-100";
  }

  return "border-black/40 bg-surface-card-header text-slate-200";
}

export function ShipmentLogisticsAssignmentBadges({
  assignment,
}: {
  assignment: ShipmentOperationalAssignment | null;
}) {
  if (!assignment) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-black leading-tight ${badgeClass(assignment.routeAssigned, assignment.isReady)}`}
        title={assignment.routeAssigned ? `Ruta: ${assignment.routeLabel}` : assignment.routeLabel}
      >
        <Route className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        {assignment.routeLabel}
      </span>
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-black leading-tight ${badgeClass(assignment.driverAssigned, assignment.isReady)}`}
        title={
          assignment.driverAssigned
            ? `Conductor: ${assignment.driverLabel}`
            : assignment.driverLabel
        }
      >
        <UserRound className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        {assignment.driverLabel}
      </span>
    </div>
  );
}
