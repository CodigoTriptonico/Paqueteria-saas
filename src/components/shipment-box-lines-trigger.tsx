"use client";

import { Boxes } from "lucide-react";
import { createPortal } from "react-dom";
import { useAnchoredPopover } from "@/hooks/use-anchored-popover";
import {
  formatBoxQuantityLabel,
  shipmentBoxLinesTriggerLabel,
  type ShipmentBoxLine,
} from "@/lib/shipment-display";

const PANEL_WIDTH = 280;

export function ShipmentBoxLinesTrigger({
  lines,
  variant = "inline",
  className = "",
}: {
  lines: ShipmentBoxLine[];
  variant?: "card" | "inline";
  className?: string;
}) {
  const { open, setOpen, position, buttonRef, panelRef } =
    useAnchoredPopover(PANEL_WIDTH);

  const triggerLabel = shipmentBoxLinesTriggerLabel(lines);
  const interactive = lines.length > 1 || lines.some((line) => line.quantity > 1);
  const boxCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (!lines.length || !triggerLabel) {
    return null;
  }

  const buttonClass =
    variant === "card"
      ? `inline-flex w-full items-center justify-center gap-2 rounded-md border border-black bg-[#26312c] px-3 py-2 text-sm font-black tabular-nums tracking-tight text-[#f8fafc] transition hover:bg-[#2c3833] sm:text-base ${className}`
      : `inline-flex max-w-full items-center gap-1.5 rounded-md border border-black/70 bg-surface-inset px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-200 transition hover:bg-surface-card-hover ${className}`;

  const staticClass =
    variant === "card"
      ? `inline-flex w-full items-center justify-center gap-2 rounded-md border border-black bg-[#26312c] px-3 py-2 text-sm font-black tabular-nums tracking-tight text-[#f8fafc] sm:text-base ${className}`
      : `inline-flex max-w-full items-center gap-1.5 rounded-md border border-black/70 bg-surface-inset px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-200 ${className}`;

  const panel =
    open && position ? (
      <div
        ref={panelRef}
        className="fixed z-50 overflow-hidden rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
        style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
        role="dialog"
        aria-label="Cajas del envío"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Cajas del envío
          </p>
          <span className="rounded-md border border-black/70 bg-surface-inset px-1.5 py-0.5 text-[10px] font-black text-slate-400">
            {boxCount} {boxCount === 1 ? "unidad" : "unidades"}
          </span>
        </div>
        <div className="space-y-1.5">
          {lines.map((line, index) => (
            <div
              key={`${line.label}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-black/60 bg-surface-inset px-2 py-2"
            >
              <span className="flex h-9 min-w-[2.25rem] shrink-0 flex-col items-center justify-center rounded-md border border-black/30 bg-black/20 px-1.5 text-center">
                <span className="text-sm font-black leading-none tabular-nums text-emerald-300">
                  {line.quantity}
                </span>
                <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-slate-500">
                  uds
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#f8fafc]">{line.label}</p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                  {formatBoxQuantityLabel(line.label, line.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  if (!interactive) {
    return (
      <span className={staticClass}>
        <Boxes className={`shrink-0 text-emerald-300 ${variant === "card" ? "h-4 w-4" : "h-3 w-3"}`} />
        {triggerLabel}
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass}
        aria-label="Ver cajas del envío"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Ver detalle de cajas"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Boxes className={`shrink-0 text-emerald-300 ${variant === "card" ? "h-4 w-4" : "h-3 w-3"}`} />
        {triggerLabel}
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
