"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  listShipmentActivityHistoryAction,
  type ActivityHistoryRow,
} from "@/app/actions/history";
import type { ShipmentRow } from "@/app/actions/shipments";
import { SalePersonPager } from "@/components/sale/sale-person-card";
import type { ShipmentProgressKind, ShipmentProgressStep } from "@/lib/shipment-display";
import { milestoneKeyForProgressKind, SHIPMENT_MILESTONE_ACTION } from "@/lib/shipment-milestones";
import {
  formatShipmentAbsolute,
  type ShipmentTimings,
} from "@/lib/shipment-timing";
import { AuditHistoryLine } from "@/components/audit-history-line";
import {
  buildStepSummarySentence,
  stepHistoryEntryTitle,
  stepHistoryTimestamp,
  supplementaryStepHistory,
} from "@/lib/shipment-step-history";
import {
  shipmentStepDetailPanelConnector,
  shipmentStepDetailPanelPosition,
  type ShipmentStepDetailPanelAnchor,
} from "@/lib/shipment-step-detail-panel";

type ShipmentStepDetailPanelProps = {
  row: ShipmentRow;
  step: ShipmentProgressStep;
  stepNumber: number;
  totalSteps: number;
  timings?: ShipmentTimings;
  anchorRect: DOMRect | null;
  stepAnchorRect?: ShipmentStepDetailPanelAnchor | null;
  onClose: () => void;
};

const STEP_MOVEMENTS_PAGE_SIZE = 3;

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

  if (row.action === "shipment.schedule_updated") {
    if (metaText(row, "stepKind") === step.kind) {
      return true;
    }

    if (taskType && metaText(row, "taskType") === taskType) {
      return true;
    }
  }

  const status = STATUS_BY_KIND[step.kind];
  return Boolean(status && metaText(row, "nextStatus") === status);
}

export function ShipmentStepDetailPanel({
  row,
  step,
  stepNumber,
  totalSteps,
  timings,
  anchorRect,
  stepAnchorRect,
  onClose,
}: ShipmentStepDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ActivityHistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(0);

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
  const extraHistory = useMemo(
    () => supplementaryStepHistory(matchingHistory, step),
    [matchingHistory, step],
  );
  const historyPageCount = Math.max(1, Math.ceil(extraHistory.length / STEP_MOVEMENTS_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPageCount - 1);
  const visibleHistory = extraHistory.slice(
    safeHistoryPage * STEP_MOVEMENTS_PAGE_SIZE,
    safeHistoryPage * STEP_MOVEMENTS_PAGE_SIZE + STEP_MOVEMENTS_PAGE_SIZE,
  );

  useEffect(() => {
    queueMicrotask(() => setHistoryPage(0));
  }, [row.id, step.kind]);
  const saleHistory = history.find(isSaleHistory);
  const completedAt = timings?.completedAtByKind[step.kind] || (step.kind === "sale" ? row.created_at : null);
  const sellerName = saleHistory?.actorName || row.salesOwnerName || "";
  const stepActor =
    matchingHistory.find((entry) => entry.action === SHIPMENT_MILESTONE_ACTION)?.actorName ||
    matchingHistory[0]?.actorName ||
    sellerName;
  const summarySentence = buildStepSummarySentence({
    step,
    completedAt,
    waitText: timings?.waitingText || "",
    actorName: stepActor,
  });
  const summaryAbsolute =
    step.state === "active" ? "" : completedAt ? formatShipmentAbsolute(completedAt) : "";

  if (!anchorRect || typeof document === "undefined") {
    return null;
  }

  const position = shipmentStepDetailPanelPosition(anchorRect, window.innerHeight);
  const connector = stepAnchorRect ? shipmentStepDetailPanelConnector(stepAnchorRect, position) : null;
  const panelCaretLeft = connector ? connector.arrowLeft - position.left - 8 : null;

  const panel = (
    <>
      {connector && connector.connectorHeight > 6 ? (
        <div
          className="pointer-events-none fixed z-[119]"
          style={{
            left: connector.stepCenterX,
            top: connector.connectorTop,
            height: connector.connectorHeight,
          }}
          aria-hidden
        >
          <span className="absolute bottom-0 left-1/2 h-full w-0.5 -translate-x-1/2 rounded-full bg-emerald-400/85" />
          <span className="absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 translate-y-[3px] border-x-[6px] border-t-[7px] border-x-transparent border-t-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]" />
        </div>
      ) : null}

      {connector && connector.caretOnPanelTop && panelCaretLeft !== null ? (
        <span
          className="pointer-events-none fixed z-[121] h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-surface-card"
          style={{ left: connector.arrowLeft - 8, top: position.top - 8 }}
          aria-hidden
        />
      ) : null}
      {connector && !connector.caretOnPanelTop && panelCaretLeft !== null ? (
        <span
          className="pointer-events-none fixed z-[121] h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-surface-card"
          style={{ left: connector.arrowLeft - 8, top: position.top + position.maxHeight - 8 }}
          aria-hidden
        />
      ) : null}

      <div
        className="fixed z-[120] overflow-y-auto overflow-x-hidden rounded-xl border border-black bg-surface-card p-3 shadow-[0_14px_36px_rgba(0,0,0,0.45)] [scrollbar-width:thin]"
        style={{
          left: position.left,
          top: position.top,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded border border-black bg-surface-inset px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
            {stepNumber}/{totalSteps}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 hover:bg-surface-card-header"
            aria-label="Cerrar detalle"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="mt-2 rounded-lg border border-black bg-surface-inset px-2.5 py-2.5">
          <h4 className="text-lg font-black leading-tight text-[#f8fafc]">{step.title}</h4>
          <p
            className={`mt-2 text-sm font-bold leading-snug ${
              step.state === "active" ? "text-amber-100" : "text-emerald-100"
            }`}
            title={summaryAbsolute || undefined}
          >
            {summarySentence}
          </p>
          {step.scheduleChanged ? (
            <p className="mt-2 text-xs font-black text-amber-200">
              Fecha modificada después de la venta
            </p>
          ) : null}
          <p className="mt-2 border-t border-black/40 pt-2 text-[11px] font-bold text-slate-500">
            {row.code} · {row.customer_name} · {row.country}
          </p>

          {loading ? (
            <p className="mt-2 border-t border-black/40 pt-2 text-xs font-bold text-slate-400">Cargando...</p>
          ) : error ? (
            <p className="mt-2 border-t border-black/40 pt-2 text-xs font-bold text-rose-300">{error}</p>
          ) : extraHistory.length ? (
            <div className="mt-2 border-t border-black/40 pt-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-600">Antes</p>
                <SalePersonPager
                  page={safeHistoryPage}
                  pageCount={historyPageCount}
                  onPrev={() => setHistoryPage((current) => Math.max(0, current - 1))}
                  onNext={() => setHistoryPage((current) => Math.min(historyPageCount - 1, current + 1))}
                  prevLabel="Movimientos anteriores"
                  nextLabel="Movimientos siguientes"
                />
              </div>
              <ol className="mt-1 grid gap-2">
                {visibleHistory.map((entry) => {
                  const title = stepHistoryEntryTitle(entry);
                  const timestamp = stepHistoryTimestamp(entry);

                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-black/60 bg-surface-card px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-black text-[#f8fafc]">{title}</p>
                        {timestamp.relative ? (
                          <time
                            className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500"
                            dateTime={entry.createdAt}
                            title={timestamp.absolute || undefined}
                          >
                            {timestamp.relative}
                          </time>
                        ) : null}
                      </div>
                      <AuditHistoryLine entry={entry} />
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
