"use client";

import { History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listShipmentActivityHistoryAction,
  type ActivityHistoryRow,
} from "@/app/actions/history";
import { AuditHistoryEntry } from "@/components/audit-history-entry";
import { secondaryButtonClass } from "@/components/ui-blocks";
import {
  consolidateShipmentActivityHistory,
} from "@/lib/shipment-step-history";

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
  const visibleRows = useMemo(() => consolidateShipmentActivityHistory(rows), [rows]);

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
          ) : visibleRows.length ? (
            <ol className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
              {visibleRows.map((row) => (
                <li key={row.id}>
                  <AuditHistoryEntry entry={row} className="bg-surface-inset" />
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
