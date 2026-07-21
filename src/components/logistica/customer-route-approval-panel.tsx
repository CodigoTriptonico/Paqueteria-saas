"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Route } from "lucide-react";
import {
  listPendingCustomerRouteAssignmentRequestsAction,
  reviewCustomerRouteAssignmentRequestAction,
  type CustomerRouteAssignmentRequestRow,
} from "@/app/actions/customer-route-assignments";
import { useNotify } from "@/hooks/use-notify";
import { Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { formatScheduleAtDisplay } from "@/lib/sale/schedule-time";

const taskTypeLabel: Record<string, string> = {
  deliver_empty_box: "Dejar caja vacía",
  pickup_full_box: "Recoger caja llena",
};

export function CustomerRouteApprovalPanel() {
  const notify = useNotify();
  const [requests, setRequests] = useState<CustomerRouteAssignmentRequestRow[]>([]);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const result = await listPendingCustomerRouteAssignmentRequestsAction();
    if (result.ok) {
      setRequests(result.data);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  function review(request: CustomerRouteAssignmentRequestRow, decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await reviewCustomerRouteAssignmentRequestAction({
        requestId: request.id,
        decision,
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(
        decision === "approved"
          ? `${request.customerName} verificado en ${request.routeTemplateName}`
          : "Solicitud rechazada",
      );
      await reload();
    });
  }

  return (
    <Panel
      title="Rutas propuestas por vendedores"
      action={<Route className="h-5 w-5 text-amber-300" />}
    >
      <p className="mb-3 text-sm font-bold text-slate-400">
        Primera asignación de un remitente a una ruta. Si apruebas, las siguientes del mismo
        remitente en esa ruta entran solas. No aparecen en la ruta hasta que apruebes.
      </p>
      {requests.length ? (
        <div className="grid gap-2">
          {requests.map((request) => (
            <article
              key={request.id}
              className="grid gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
            >
              <div className="min-w-0">
                <p className="font-black text-slate-100">
                  {request.customerName}{" "}
                  <span className="text-xs text-emerald-300">{request.shipmentCode}</span>
                </p>
                <p className="truncate text-xs font-bold text-slate-400">
                  {taskTypeLabel[request.taskType] || request.taskType} · {request.routeTemplateName} ·{" "}
                  {formatScheduleAtDisplay(request.scheduledAt)} · {request.driverLabel}
                </p>
                <p className="truncate text-xs font-bold text-slate-500">Zona {request.zoneKey}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={pending}
                  onClick={() => review(request, "approved")}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Aprobar
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={pending}
                  onClick={() => review(request, "rejected")}
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">
          No hay rutas pendientes de aprobación.
        </div>
      )}
    </Panel>
  );
}
