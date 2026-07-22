"use client";

import { Loader2, Warehouse, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

const compactInputClass = `${inputClass} h-11`;

type CreateWarehouseModalProps = {
  open: boolean;
  name: string;
  busy: boolean;
  atLimit: boolean;
  planMaxWarehouses: number | null;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onCreate: () => void;
};

export function CreateWarehouseModal({
  open,
  name,
  busy,
  atLimit,
  planMaxWarehouses,
  onClose,
  onNameChange,
  onCreate,
}: CreateWarehouseModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
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
        aria-labelledby="create-warehouse-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950">
              <Warehouse className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-slate-500">Bodegas</p>
              <h3
                id="create-warehouse-modal-title"
                className="text-2xl font-black text-[#f8fafc]"
              >
                Nueva bodega
              </h3>
              <p className="mt-1 text-sm font-bold text-slate-400">
                Ponle un nombre claro para el equipo.
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
            if (!name.trim() || busy || atLimit) {
              return;
            }
            onCreate();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase text-slate-500">Nombre</span>
            <input
              ref={inputRef}
              className={compactInputClass}
              placeholder="Ej: Bodega norte"
              value={name}
              disabled={busy || atLimit}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>

          {atLimit ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-xs font-bold text-amber-100">
              Límite del plan alcanzado
              {planMaxWarehouses !== null ? ` (${planMaxWarehouses} en total)` : ""}.
            </p>
          ) : null}

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
              disabled={!name.trim() || busy || atLimit}
              className={`${primaryButtonClass} h-11 gap-2 disabled:opacity-40`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Crear bodega
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
