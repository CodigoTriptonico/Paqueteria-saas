"use client";

import { secondaryButtonClass } from "@/components/ui-blocks";

export type ActionConfirmTone = "warning" | "danger";

export function actionConfirmButtonClass(tone: ActionConfirmTone = "warning") {
  if (tone === "danger") {
    return "h-11 rounded-lg border border-rose-700/60 bg-rose-950/50 text-sm font-black text-rose-100 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40";
  }

  return "h-11 rounded-lg border border-amber-700/60 bg-amber-950/50 text-sm font-black text-amber-100 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40";
}

type ActionConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ActionConfirmTone;
  confirming?: boolean;
  dialogId?: string;
  overlayClassName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ActionConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "warning",
  confirming = false,
  dialogId = "action-confirm-dialog",
  overlayClassName = "z-[140]",
  onCancel,
  onConfirm,
}: ActionConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black/70 p-4 ${overlayClassName}`}>
      <button
        type="button"
        aria-label="Cerrar confirmación"
        className="absolute inset-0"
        onClick={onCancel}
        disabled={confirming}
      />
      <div
        id={dialogId}
        className="relative w-full max-w-sm rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
      >
        <p id={`${dialogId}-title`} className="text-xl font-black text-[#f8fafc]">
          {title}
        </p>
        <p className="mt-2 text-sm font-bold leading-snug text-slate-400">{message}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={actionConfirmButtonClass(tone)}
          >
            {confirming ? "Guardando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
