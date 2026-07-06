"use client";

import { History, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listShipmentActivityHistoryAction,
  type ActivityHistoryRow,
} from "@/app/actions/history";
import { listShipmentsAction, type ShipmentRow } from "@/app/actions/shipments";
import { AuditHistoryEntry } from "@/components/audit-history-entry";
import { PageLoading } from "@/components/page-loading";
import { cardClass } from "@/components/ui-blocks";
import {
  consolidateShipmentActivityHistory,
} from "@/lib/shipment-step-history";
import { shipmentLogisticsSteps } from "@/lib/shipment-display";
import {
  buildShipmentAuditTimings,
  formatShipmentAbsolute,
  formatShipmentDuration,
  formatShipmentRelative,
} from "@/lib/shipment-timing";

type EstadisticasAuditoriaPanelProps = {
  initialShipments?: ShipmentRow[];
  selectedShipmentId?: string | null;
};

export function EstadisticasAuditoriaPanel({
  initialShipments = [],
  selectedShipmentId = null,
}: EstadisticasAuditoriaPanelProps) {
  const [shipments, setShipments] = useState(initialShipments);
  const [loadingShipments, setLoadingShipments] = useState(!initialShipments.length);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(selectedShipmentId || "");
  const [history, setHistory] = useState<ActivityHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (initialShipments.length) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingShipments(true);
      const result = await listShipmentsAction();

      if (cancelled) {
        return;
      }

      setLoadingShipments(false);

      if (result.ok) {
        setShipments(result.data);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialShipments.length]);

  useEffect(() => {
    if (selectedShipmentId) {
      let cancelled = false;

      queueMicrotask(() => {
        if (!cancelled) {
          setSelectedId(selectedShipmentId);
        }
      });

      return () => {
        cancelled = true;
      };
    }
  }, [selectedShipmentId]);

  const filteredShipments = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return shipments.slice(0, 40);
    }

    return shipments
      .filter((row) => {
        return (
          row.code.toLowerCase().includes(needle) ||
          row.customer_name.toLowerCase().includes(needle)
        );
      })
      .slice(0, 40);
  }, [query, shipments]);

  const selectedShipment = useMemo(
    () => shipments.find((row) => row.id === selectedId) || null,
    [selectedId, shipments],
  );

  const auditTimings = useMemo(() => {
    if (!selectedShipment) {
      return null;
    }

    return buildShipmentAuditTimings(selectedShipment, shipmentLogisticsSteps(selectedShipment));
  }, [selectedShipment]);

  const visibleHistory = useMemo(
    () => consolidateShipmentActivityHistory(history),
    [history],
  );

  useEffect(() => {
    if (!selectedId) {
      let cancelled = false;

      queueMicrotask(() => {
        if (!cancelled) {
          setHistory([]);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;

    void (async () => {
      setLoadingHistory(true);
      setHistoryError("");

      const result = await listShipmentActivityHistoryAction(selectedId);

      if (cancelled) {
        return;
      }

      setLoadingHistory(false);

      if (!result.ok) {
        setHistoryError(result.error);
        setHistory([]);
        return;
      }

      setHistory(result.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (loadingShipments) {
    return <PageLoading inline />;
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <section className={`${cardClass} flex min-h-0 flex-col p-3`}>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar invoice o cliente"
            className="h-9 w-full rounded-lg border border-black bg-surface-inset pl-8 pr-2 text-sm font-bold text-[#f8fafc] outline-none"
          />
        </label>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {filteredShipments.length ? (
            <ul className="grid gap-1">
              {filteredShipments.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                      selectedId === row.id
                        ? "border-emerald-700/50 bg-emerald-950/30"
                        : "border-black bg-surface-inset hover:bg-surface-card"
                    }`}
                  >
                    <p className="truncate text-sm font-black text-[#f8fafc]">{row.code}</p>
                    <p className="truncate text-[11px] font-bold text-slate-400">{row.customer_name}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-4 text-sm font-bold text-slate-500">Sin resultados</p>
          )}
        </div>
      </section>

      <section className={`${cardClass} min-h-0 p-4`}>
        {!selectedShipment || !auditTimings ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center text-center">
            <History className="h-8 w-8 text-slate-500" />
            <p className="mt-3 text-lg font-black text-[#f8fafc]">Selecciona un invoice</p>
            <p className="mt-1 max-w-sm text-sm font-bold text-slate-400">
              Aquí verás fechas de orden, programación, asignación y tiempos entre cada hito.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <p className="text-xl font-black text-[#f8fafc]">
                {selectedShipment.code} · {selectedShipment.customer_name}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                Vendedor: {selectedShipment.salesOwnerName || "—"} · Venta{" "}
                {selectedShipment.created_at
                  ? formatShipmentRelative(selectedShipment.created_at)
                  : "—"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[auditTimings.emptyBoxLeg, auditTimings.fullBoxLeg]
                .filter((leg): leg is NonNullable<typeof leg> => Boolean(leg))
                .map((leg) => (
                  <div
                    key={leg.taskType}
                    className="rounded-lg border border-black bg-surface-inset p-3"
                  >
                    <p className="text-xs font-black uppercase text-slate-500">{leg.legLabel}</p>
                    {leg.activePhaseLabel && !leg.completedAt ? (
                      <p className="mt-1 text-sm font-black text-amber-200">
                        Lleva {formatShipmentDuration(leg.activeElapsedMs || 0)} {leg.activePhaseLabel}
                      </p>
                    ) : null}
                    {leg.orderToCompleteLabel ? (
                      <p className="mt-1 text-sm font-black text-emerald-200">
                        Orden → completada · {leg.orderToCompleteLabel}
                      </p>
                    ) : null}
                    <ul className="mt-2 grid gap-1.5">
                      {leg.phases
                        .filter((phase) => phase.at)
                        .map((phase) => (
                          <li
                            key={phase.key}
                            className="flex items-start justify-between gap-2 text-[11px] font-bold text-slate-300"
                          >
                            <span>{phase.label}</span>
                            <span className="text-right text-slate-400">
                              {formatShipmentAbsolute(phase.at || "")}
                              {phase.relative ? ` · ${phase.relative}` : ""}
                              {phase.gapFromPreviousLabel
                                ? ` · +${phase.gapFromPreviousLabel}`
                                : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
            </div>

            {auditTimings.completedGapsLine ? (
              <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Tramos del envío</p>
                <p className="mt-1 text-sm font-bold leading-snug text-slate-300">
                  {auditTimings.completedGapsLine}
                </p>
              </div>
            ) : null}

            {auditTimings.logisticsGapsLine ? (
              <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
                <p className="text-[10px] font-black uppercase text-slate-500">Tramos logísticos</p>
                <p className="mt-1 text-sm font-bold leading-snug text-slate-300">
                  {auditTimings.logisticsGapsLine}
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
              <p className="text-[10px] font-black uppercase text-slate-500">Historial</p>
              {loadingHistory ? (
                <p className="mt-2 text-sm font-bold text-slate-400">Cargando historial…</p>
              ) : historyError ? (
                <p className="mt-2 text-sm font-bold text-rose-300">{historyError}</p>
              ) : visibleHistory.length ? (
                <ul className="mt-2 grid gap-2">
                  {visibleHistory.map((entry) => (
                    <li key={entry.id}>
                      <AuditHistoryEntry entry={entry} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm font-bold text-slate-400">Sin eventos registrados.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
