"use client";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { driverChangeDialogCopy, driverLabel } from "@/lib/logistics-view";

type LogisticsDriverChangeDialogProps = {
  open: boolean;
  shipmentCode: string;
  customerName: string;
  taskTypeLabel: string;
  currentAssignedTo: string | null;
  nextAssignedTo: string | null;
  memberById: ReadonlyMap<string, string>;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LogisticsDriverChangeDialog({
  open,
  shipmentCode,
  customerName,
  taskTypeLabel,
  currentAssignedTo,
  nextAssignedTo,
  memberById,
  confirming = false,
  onCancel,
  onConfirm,
}: LogisticsDriverChangeDialogProps) {
  if (!open) {
    return null;
  }

  const copy = driverChangeDialogCopy(currentAssignedTo, nextAssignedTo);
  const currentLabel = driverLabel(currentAssignedTo, memberById);
  const nextLabel = driverLabel(nextAssignedTo, memberById);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistics-driver-change-title"
      >
        <p id="logistics-driver-change-title" className="text-xl font-black text-[#f8fafc]">
          {copy.title}
        </p>
        <p className="mt-1 text-sm font-bold text-slate-400">
          {shipmentCode} · {customerName}
        </p>
        <p className="mt-3 rounded-lg border border-amber-900/70 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-100">
          {copy.warningMessage}
        </p>

        <dl className="mt-4 grid gap-2 rounded-lg border border-black bg-surface-card px-3 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-bold text-slate-400">Tarea</dt>
            <dd className="font-black text-[#f8fafc]">{taskTypeLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-bold text-slate-400">Chofer actual</dt>
            <dd className="font-black text-[#f8fafc]">{currentLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-bold text-slate-400">Chofer nuevo</dt>
            <dd className="font-black text-emerald-300">{nextLabel}</dd>
          </div>
        </dl>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {confirming ? copy.confirmingLabel : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
