"use client";

import { User } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  SALE_PERSON_CARD_VARIANTS,
  type SalePersonCardVariantId,
} from "@/components/sale/sale-person-card-variants";

type SalePersonStylePickerProps = {
  x: number;
  y: number;
  currentStyle: SalePersonCardVariantId;
  onSelect: (styleId: SalePersonCardVariantId) => void;
  onClose: () => void;
};

export function SalePersonStylePicker({
  x,
  y,
  currentStyle,
  onSelect,
  onClose,
}: SalePersonStylePickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const panelWidth = 280;
  const panelHeight = 320;
  const left = Math.min(Math.max(12, x), window.innerWidth - panelWidth - 12);
  const top = Math.min(Math.max(12, y), window.innerHeight - panelHeight - 12);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Elegir estilo de tarjeta"
      className="fixed z-[60] w-[17.5rem] rounded-xl border border-black bg-surface-panel p-3 shadow-2xl"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Color de tarjeta
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SALE_PERSON_CARD_VARIANTS.map((variant) => {
          const selected = variant.id === currentStyle;

          return (
            <button
              key={variant.id}
              type="button"
              title={variant.label}
              onClick={() => {
                onSelect(variant.id);
                onClose();
              }}
              className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition hover:bg-surface-card ${
                selected
                  ? "border-emerald-600 bg-emerald-400/10"
                  : "border-black bg-surface-inset"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-black/40 shadow-sm ${variant.swatch}`}
              >
                <span className={`h-3 w-3 rounded-md ${variant.iconWell}`} />
                <User className="h-2.5 w-2.5 text-slate-950/80" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase text-slate-500">
                  {variant.tag}
                </span>
                <span className="block truncate text-xs font-black text-[#f8fafc]">
                  {variant.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
