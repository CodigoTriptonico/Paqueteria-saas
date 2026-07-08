"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  milestoneAgeDisplayValue,
  milestoneAgeIndicatorButtonClass,
  milestoneAgeTextClass,
  type ShipmentMilestoneAge,
} from "@/lib/shipment-timing";

const PANEL_WIDTH = 176;

export function ShipmentMilestoneAgeTrigger({
  ages,
  className = "",
}: {
  ages: ShipmentMilestoneAge[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const anchor = buttonRef.current;
      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - PANEL_WIDTH - 8);
      setPosition({
        top: rect.bottom + 6,
        left: Math.min(rect.left, maxLeft),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const panel =
    open && position ? (
      <div
        ref={panelRef}
        className="fixed z-50 overflow-hidden rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
        style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
        role="dialog"
        aria-label="Tiempos de venta, entrega y recolección"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="space-y-1">
          {ages.map((age) => (
            <div
              key={age.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-black/60 bg-surface-inset px-2 py-1.5"
              title={age.detailLabel || age.label}
            >
              <span className="text-[10px] font-black uppercase text-slate-500">{age.label}</span>
              <span
                className={`truncate text-[11px] font-black tabular-nums ${milestoneAgeTextClass(age.status, age.elapsedMs)}`}
              >
                {milestoneAgeDisplayValue(age)}
              </span>
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
        aria-label="Ver tiempos de venta, entrega y recolección"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Tiempos: venta, entrega, recolección"
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
