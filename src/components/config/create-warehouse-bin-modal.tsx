"use client";

import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import {
  buildWarehouseBinCode,
  buildWarehouseBinLabel,
} from "@/lib/inventory-bins";

const fieldInputClass = `${inputClass} h-11 w-full min-w-0 text-center text-base font-black tracking-wide`;
const fieldLabelClass =
  "block w-full text-center text-[11px] font-black uppercase tracking-wide text-slate-500";

type CreateWarehouseBinModalProps = {
  open: boolean;
  warehouseName: string;
  busy: boolean;
  zone: string;
  aisle: string;
  shelf: string;
  label: string;
  onClose: () => void;
  onZoneChange: (value: string) => void;
  onAisleChange: (value: string) => void;
  onShelfChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onCreate: () => void;
};

export function CreateWarehouseBinModal({
  open,
  warehouseName,
  busy,
  zone,
  aisle,
  shelf,
  label,
  onClose,
  onZoneChange,
  onAisleChange,
  onShelfChange,
  onLabelChange,
  onCreate,
}: CreateWarehouseBinModalProps) {
  const zoneRef = useRef<HTMLInputElement>(null);
  const previewCode = buildWarehouseBinCode({ zone, aisle, shelf });
  const previewLabel = previewCode
    ? buildWarehouseBinLabel({ zone, aisle, shelf, label, code: previewCode })
    : "";

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      zoneRef.current?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, busy]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="app-modal-overlay fixed inset-0 z-[140] flex justify-center bg-black/70 p-3 sm:p-4">
      <div
        className="app-modal-content flex w-full max-w-md flex-col rounded-xl border border-black bg-surface-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-bin-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-slate-500">
                {warehouseName || "Bodega"}
              </p>
              <h3
                id="create-bin-modal-title"
                className="text-2xl font-black text-[#f8fafc]"
              >
                Nuevo estante
              </h3>
              <p className="mt-1 text-sm font-bold text-slate-400">
                Zona, pasillo y estante forman el código.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 px-4 py-4 sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!previewCode || busy) {
              return;
            }
            onCreate();
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabelClass}>Zona</span>
              <input
                ref={zoneRef}
                className={fieldInputClass}
                value={zone}
                disabled={busy}
                placeholder="A"
                size={1}
                onChange={(event) => onZoneChange(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabelClass}>Pasillo</span>
              <input
                className={fieldInputClass}
                value={aisle}
                disabled={busy}
                placeholder="2"
                size={1}
                onChange={(event) => onAisleChange(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className={fieldLabelClass}>Estante</span>
              <input
                className={fieldInputClass}
                value={shelf}
                disabled={busy}
                placeholder="3"
                size={1}
                onChange={(event) => onShelfChange(event.target.value)}
              />
            </label>
          </div>

          <div className="rounded-xl border border-black bg-surface-inset px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Código
            </p>
            <p className="mt-1 font-mono text-xl font-black tracking-wider text-emerald-300">
              {previewCode || "—"}
            </p>
            {previewLabel ? (
              <p className="mt-1 text-sm font-bold text-slate-400">{previewLabel}</p>
            ) : null}
          </div>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Etiqueta opcional
            </span>
            <input
              className={`${inputClass} h-11`}
              value={label}
              disabled={busy}
              placeholder={previewLabel || "Ej: Zona fría"}
              onChange={(event) => onLabelChange(event.target.value)}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={`${secondaryButtonClass} h-11 disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!previewCode || busy}
              className={`${primaryButtonClass} h-11 gap-2 disabled:opacity-40`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Crear estante
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
