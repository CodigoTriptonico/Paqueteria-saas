"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listShipmentActivityHistoryAction,
  type ActivityHistoryRow,
} from "@/app/actions/history";
import { historyDateLabel } from "@/components/sale/venta-parts";
import { secondaryButtonClass } from "@/components/ui-blocks";
import { shipmentAuditActionLabel } from "@/lib/shipment-audit";

type ShipmentAuditPanelProps = {
  shipmentId: string;
  refreshNonce?: number;
  /** En el pie de la tarjeta, junto a otras acciones */
  inline?: boolean;
  compact?: boolean;
};

export function ShipmentAuditPanel({
  shipmentId,
  refreshNonce = 0,
  inline = false,
  compact = false,
}: ShipmentAuditPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ActivityHistoryRow[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        setError("");

        const result = await listShipmentActivityHistoryAction(shipmentId);

        if (cancelled) {
          return;
        }

        setLoading(false);

        if (!result.ok) {
          setError(result.error);
          setRows([]);
          return;
        }

        setRows(result.data);
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [open, refreshNonce, shipmentId]);

  return (
    <div className={inline ? "relative" : "mt-3 border-t border-black/70 pt-3"}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          inline
            ? compact
              ? "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 hover:bg-surface-card"
              : `${secondaryButtonClass} inline-flex items-center gap-2 px-3 py-2 text-xs font-black`
            : "inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-300"
        }
      >
        <History className="h-3.5 w-3.5" aria-hidden />
        {inline && compact ? <span className="sr-only">Auditoría</span> : "Auditoría"}
      </button>

      {open ? (
        <div
          className={
            inline
              ? "absolute bottom-full right-0 z-20 mb-2 w-[min(100vw-2rem,24rem)] rounded-xl border border-black bg-surface-card p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              : "mt-2 rounded-xl border border-black bg-surface-card-header p-3"
          }
        >
          {loading ? (
            <p className="text-sm font-bold text-slate-400">Cargando historial...</p>
          ) : error ? (
            <p className="text-sm font-bold text-rose-300">{error}</p>
          ) : rows.length ? (
            <ol className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-black/70 bg-surface-inset px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase text-emerald-300">
                      {shipmentAuditActionLabel(row.action)}
                    </p>
                    <p className="text-[11px] font-bold tabular-nums text-slate-500">
                      {historyDateLabel(row.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-black text-[#f8fafc]">{row.title}</p>
                  <p className="mt-1 text-xs font-bold leading-snug text-slate-400">{row.description}</p>
                  <p className="mt-2 text-[11px] font-black text-slate-500">Por {row.actorName}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm font-bold text-slate-400">Sin movimientos registrados todavía.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
