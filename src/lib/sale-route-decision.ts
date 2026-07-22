import { isoToPlanScheduleAt } from "@/lib/shipment-schedule-history";

export type SaleRouteDecision =
  | {
      kind: "selected";
      routeDate: string;
      routeTemplateId: string;
      routeLabel: string;
      scheduledAt: string;
    }
  | {
      kind: "pending";
      routeDate: string;
    };

export function saleRouteDecisionSummary(decision: SaleRouteDecision | null) {
  if (!decision) {
    return "";
  }

  if (decision.kind === "pending") {
    return `Ruta pendiente · ${decision.routeDate}`;
  }

  return `${decision.routeLabel} · ${isoToPlanScheduleAt(decision.scheduledAt)}`;
}

export function saleRouteDecisionSchedule(decision: SaleRouteDecision | null) {
  if (!decision) {
    return { scheduleMode: "", scheduleAt: "" } as const;
  }

  if (decision.kind === "pending") {
    return { scheduleMode: "pending", scheduleAt: "" } as const;
  }

  return {
    scheduleMode: "scheduled",
    scheduleAt: isoToPlanScheduleAt(decision.scheduledAt),
  } as const;
}

export function saleRouteDecisionTask(decision: SaleRouteDecision) {
  return decision.kind === "selected"
    ? {
        taskType: "deliver_empty_box" as const,
        status: "scheduled" as const,
        scheduledAt: decision.scheduledAt,
        requestedRouteDate: null,
      }
    : {
        taskType: "deliver_empty_box" as const,
        status: "pending" as const,
        scheduledAt: null,
        requestedRouteDate: decision.routeDate,
      };
}
