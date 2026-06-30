"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listShipmentActivityHistoryAction,
  type ActivityHistoryRow,
} from "@/app/actions/history";
import type { ShipmentRow } from "@/app/actions/shipments";
import type { ShipmentProgressKind, ShipmentProgressStep } from "@/lib/shipment-display";
import { shipmentAuditActionLabel } from "@/lib/shipment-audit";
import { milestoneKeyForProgressKind } from "@/lib/shipment-milestones";
import {
  formatShipmentAbsolute,
  formatShipmentRelative,
  type ShipmentTimings,
} from "@/lib/shipment-timing";

type ShipmentStepDetailPanelProps = {
  row: ShipmentRow;
  step: ShipmentProgressStep;
  stepNumber: number;
  totalSteps: number;
  timings?: ShipmentTimings;
  onClose: () => void;
};

const STATUS_BY_KIND: Partial<Record<ShipmentProgressKind, string>> = {
  office: "En oficina",
  pickup: "Pickup",
  transit: "Enviado",
  delivered: "Entregado",
};

function metaText(row: ActivityHistoryRow, key: string) {
  const value = row.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function taskTypeForStep(kind: ShipmentProgressKind) {
  if (kind === "empty_box") {
    return "deliver_empty_box";
  }

  if (kind === "full_box") {
    return "pickup_full_box";
  }

  return "";
}

function isSaleHistory(row: ActivityHistoryRow) {
  return (
    row.action === "sale.created" ||
    row.action === "sale.open_invoice_created" ||
    row.action === "sale.empty_box_deposit"
  );
}

function historyMatchesStep(row: ActivityHistoryRow, step: ShipmentProgressStep) {
  if (step.kind === "sale") {
    return isSaleHistory(row);
  }

  if (metaText(row, "stepKind") === step.kind || metaText(row, "stepTitle") === step.title) {
    return true;
  }

  const milestone = milestoneKeyForProgressKind(step.kind);
  if (milestone && metaText(row, "milestone") === milestone) {
    return true;
  }

  const taskType = taskTypeForStep(step.kind);
  if (taskType && metaText(row, "taskType") === taskType) {
    return true;
  }

  const status = STATUS_BY_KIND[step.kind];
  return Boolean(status && metaText(row, "nextStatus") === status);
}

function stateLabel(state: ShipmentProgressStep["state"]) {
  if (state === "done") {
    return "Completado";
  }

  if (state === "active") {
    return "Actual";
  }

  return "Pendiente";
}

function stateClass(state: ShipmentProgressStep["state"]) {
  if (state === "done") {
    return "bg-emerald-400 text-slate-950";
  }

  if (state === "active") {
    return "bg-amber-400 text-slate-950";
  }

  return "bg-surface-inset text-slate-400";
}

function dateLine(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const relative = formatShipmentRelative(iso);
  const absolute = formatShipmentAbsolute(iso);

  return [relative, absolute].filter(Boolean).join(" · ");
}

export function ShipmentStepDetailPanel({
  row,
  step,
  stepNumber,
  totalSteps,
  timings,
  onClose,
}: ShipmentStepDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ActivityHistoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        setError("");

        const result = await listShipmentActivityHistoryAction(row.id);

        if (cancelled) {
          return;
        }

        setLoading(false);

        if (!result.ok) {
          setError(result.error);
          setHistory([]);
          return;
        }

        setHistory(result.data);
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const matchingHistory = useMemo(
    () => history.filter((entry) => historyMatchesStep(entry, step)),
    [history, step],
  );
  const saleHistory = history.find(isSaleHistory);
  const stepActor = matchingHistory[0]?.actorName || (step.kind === "sale" ? saleHistory?.actorName : "");
  const completedAt = timings?.completedAtByKind[step.kind] || (step.kind === "sale" ? row.created_at : null);
  const dateText = dateLine(completedAt);
  const waitText =
    step.state === "active"
      ? timings?.waitingText || ""
      : "";

  return (
    <div
      className="absolute left-0 right-0 top-[4.25rem] z-30 rounded-xl border border-black bg-surface-card p-3 shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase text-slate-500">
            Paso {stepNumber} de {totalSteps}
          </p>
          <h4 className="mt-1 text-base font-black leading-tight text-[#f8fafc]">{step.title}</h4>
          <p className="mt-1 text-xs font-bold leading-snug text-slate-400">{step.detail}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 hover:bg-surface-card-header"
          aria-label="Cerrar detalle"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-black bg-surface-inset px-2.5 py-2">
          <p className="text-[9px] font-black uppercase text-slate-500">Estado</p>
          <p className={`mt-1 inline-flex rounded px-2 py-1 text-[11px] font-black ${stateClass(step.state)}`}>
            {stateLabel(step.state)}
          </p>
        </div>
        <div className="rounded-lg border border-black bg-surface-inset px-2.5 py-2">
          <p className="text-[9px] font-black uppercase text-slate-500">Canal</p>
          <p className="mt-1 text-sm font-black text-[#f8fafc]">{step.channelLabel || "General"}</p>
        </div>
        <div className="rounded-lg border border-black bg-surface-inset px-2.5 py-2">
          <p className="text-[9px] font-black uppercase text-slate-500">
            {step.state === "active" ? "Tiempo" : "Fecha"}
          </p>
          <p className="mt-1 text-xs font-bold leading-snug text-slate-300">
            {waitText || dateText || "Sin registro"}
          </p>
        </div>
        <div className="rounded-lg border border-black bg-surface-inset px-2.5 py-2">
          <p className="text-[9px] font-black uppercase text-slate-500">Por</p>
          <p className="mt-1 truncate text-sm font-black text-[#f8fafc]">
            {stepActor || "Sin registro"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-black bg-surface-inset px-2.5 py-2">
        <p className="text-[9px] font-black uppercase text-slate-500">Venta</p>
        <p className="mt-1 text-xs font-bold leading-snug text-slate-300">
          {row.code} · {row.customer_name} · {row.country}
        </p>
        <p className="mt-1 text-[11px] font-black text-slate-500">
          Vendió: {saleHistory?.actorName || "Sin registro"}
        </p>
      </div>

      <div className="mt-3">
        <p className="text-[9px] font-black uppercase text-slate-500">Movimientos del paso</p>
        {loading ? (
          <p className="mt-2 text-xs font-bold text-slate-400">Cargando historial...</p>
        ) : error ? (
          <p className="mt-2 text-xs font-bold text-rose-300">{error}</p>
        ) : matchingHistory.length ? (
          <ol className="mt-2 grid max-h-40 gap-1.5 overflow-y-auto pr-1">
            {matchingHistory.slice(0, 5).map((entry) => (
              <li key={entry.id} className="rounded border border-black/60 bg-surface-card-header px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-black uppercase text-emerald-300">
                    {shipmentAuditActionLabel(entry.action)}
                  </p>
                  <p className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">
                    {formatShipmentAbsolute(entry.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-xs font-black leading-snug text-[#f8fafc]">{entry.title}</p>
                {entry.description ? (
                  <p className="mt-0.5 text-[11px] font-bold leading-snug text-slate-400">
                    {entry.description}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] font-black text-slate-500">Por {entry.actorName}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-xs font-bold text-slate-400">Sin movimiento específico.</p>
        )}
      </div>
    </div>
  );
}
