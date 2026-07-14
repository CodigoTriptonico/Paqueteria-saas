"use client";

import { Clock } from "lucide-react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/hooks/use-anchored-popover";
import {
  milestoneAgeIndicatorButtonClass,
  timingInsightRowTextClass,
  type ShipmentMilestoneAge,
  type ShipmentTimingInsightRow,
} from "@/lib/shipment-timing";

const PANEL_WIDTH = 272;

export function ShipmentMilestoneAgeTrigger({
  ages,
  insights,
  className = "",
}: {
  ages: ShipmentMilestoneAge[];
  insights: ShipmentTimingInsightRow[];
  className?: string;
}) {
  const { open, setOpen, position, buttonRef, panelRef } =
    useAnchoredPopover(PANEL_WIDTH);

  const panel =
    open && position ? (
      <div
        ref={panelRef}
        className="fixed z-50 overflow-hidden rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
        style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
        role="dialog"
        aria-label="Tiempos entre pasos del envío"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <p className="px-1 pb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
          Tiempos del envío
        </p>
        <div className="space-y-1">
          {insights.map((insight, index) => (
            <div
              key={insight.id}
              className={`rounded-lg border border-black/60 bg-surface-inset px-2 py-1.5 ${
                index > 0 ? "ml-2 border-l-2 border-l-slate-700/80" : ""
              }`}
              title={insight.detail || insight.label}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`min-w-0 flex-1 text-[10px] font-black uppercase leading-snug ${
                    insight.id === "sale" ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {insight.label}
                </span>
                <span
                  className={`shrink-0 text-[11px] font-black tabular-nums leading-none ${timingInsightRowTextClass(insight.status, insight.elapsedMs)}`}
                >
                  {insight.value}
                </span>
              </div>
              {insight.detail && insight.id !== "sale" ? (
                <p className="mt-1 text-[9px] font-bold leading-snug text-slate-500">
                  {insight.detail}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${milestoneAgeIndicatorButtonClass(ages)} ${className}`}
        aria-label="Ver tiempos entre pasos del envío"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Tiempos entre pasos"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Clock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
