"use client";

import { Loader2, Package, PackageOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadInventoryCustodySnapshotAction } from "@/app/actions/inventory-custody";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";
import {
  buildInventoryCustodyEmptyRows,
  inventoryCustodyEmptyColumnLabels,
  sumInventoryCustodyEmptyRows,
  sumInventoryCustodyFullCounts,
  type InventoryCustodyAgencyRow,
  type InventoryCustodyFullCount,
} from "@/lib/inventory-custody";
import type { InventoryStockItem } from "@/lib/inventory-stock";

type CustodyKindTab = "empty" | "full";

const custodyKindTabs: AppTabDefinition<CustodyKindTab>[] = [
  { id: "empty", label: "Vacías", icon: PackageOpen },
  { id: "full", label: "Llenas", icon: Package },
];

function CustodyMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn" | "muted";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-300"
      : tone === "muted"
        ? "text-slate-500"
        : "text-[#f8fafc]";

  return (
    <div className="rounded-lg border border-black bg-[#111827] px-2 py-2 text-center">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-black tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function EmptyCustodyTable({
  rows,
  warehouseName,
  agencyModuleEnabled,
}: {
  rows: ReturnType<typeof buildInventoryCustodyEmptyRows>;
  warehouseName?: string;
  agencyModuleEnabled: boolean;
}) {
  const totals = useMemo(() => sumInventoryCustodyEmptyRows(rows), [rows]);

  if (!rows.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-[#111827] text-slate-500">
          <PackageOpen className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-4 text-base font-black text-[#f8fafc]">Sin cajas vacías en seguimiento</p>
        <p className="mt-1 max-w-xs text-sm font-bold text-slate-500">
          {warehouseName
            ? `Cuando haya stock, asignaciones o camión${agencyModuleEnabled ? " o agencias" : ""} para ${warehouseName}, aparecerán aquí.`
            : `Cuando haya stock, asignaciones o camión${agencyModuleEnabled ? " o agencias" : ""}, aparecerán aquí.`}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-[#1a2320]">
          <tr className="border-b border-black/70 text-[10px] font-black uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Producto</th>
            <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.warehouseAvailable}</th>
            <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.reserved}</th>
            <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.assigned}</th>
            <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.onTruck}</th>
            {agencyModuleEnabled ? <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.atAgencyAvailable}</th> : null}
            {agencyModuleEnabled ? <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.atAgencyAllocated}</th> : null}
            <th className="px-2 py-2 text-right">{inventoryCustodyEmptyColumnLabels.unavailable}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-black/50 hover:bg-[#111827]/60">
              <td className="px-3 py-2.5 font-black text-[#f8fafc]">{row.label}</td>
              <td className="px-2 py-2.5 text-right font-black tabular-nums text-emerald-300">
                {row.warehouseAvailable}
              </td>
              <td className="px-2 py-2.5 text-right font-black tabular-nums text-slate-300">
                {row.reserved}
              </td>
              <td className="px-2 py-2.5 text-right font-black tabular-nums text-sky-300">
                {row.assigned}
              </td>
              <td className="px-2 py-2.5 text-right font-black tabular-nums text-violet-300">
                {row.onTruck}
              </td>
              {agencyModuleEnabled ? <td className="px-2 py-2.5 text-right font-black tabular-nums text-cyan-300">
                {row.atAgencyAvailable}
              </td> : null}
              {agencyModuleEnabled ? <td className="px-2 py-2.5 text-right font-black tabular-nums text-amber-300">
                {row.atAgencyAllocated}
              </td> : null}
              <td className="px-2 py-2.5 text-right font-black tabular-nums text-rose-300">
                {row.unavailable}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-black bg-[#111827] text-[11px] font-black uppercase tracking-wide text-slate-400">
            <td className="px-3 py-2">Total</td>
            <td className="px-2 py-2 text-right tabular-nums text-emerald-300">{totals.warehouseAvailable}</td>
            <td className="px-2 py-2 text-right tabular-nums">{totals.reserved}</td>
            <td className="px-2 py-2 text-right tabular-nums">{totals.assigned}</td>
            <td className="px-2 py-2 text-right tabular-nums">{totals.onTruck}</td>
            {agencyModuleEnabled ? <td className="px-2 py-2 text-right tabular-nums">{totals.atAgencyAvailable}</td> : null}
            {agencyModuleEnabled ? <td className="px-2 py-2 text-right tabular-nums">{totals.atAgencyAllocated}</td> : null}
            <td className="px-2 py-2 text-right tabular-nums">{totals.unavailable}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FullCustodyList({ rows }: { rows: InventoryCustodyFullCount[] }) {
  const total = sumInventoryCustodyFullCounts(rows);

  if (!rows.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-[#111827] text-slate-500">
          <Package className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-4 text-base font-black text-[#f8fafc]">Sin cajas llenas registradas</p>
        <p className="mt-1 max-w-xs text-sm font-bold text-slate-500">
          Las cajas con código aparecen aquí cuando se recolectan o ingresan a bodega.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <CustodyMetric label="Total llenas" value={total} />
        <CustodyMetric
          label="En bodega / paleta"
          value={rows
            .filter((row) =>
              ["in_warehouse", "on_pallet", "warehouse_intake", "pending_intake"].includes(row.status),
            )
            .reduce((sum, row) => sum + row.count, 0)}
        />
        <CustodyMetric
          label="Internacional"
          value={rows.find((row) => row.status === "handed_to_carrier")?.count || 0}
          tone="warn"
        />
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.status}
            className="flex items-center justify-between rounded-xl border border-black bg-[#111827] px-3 py-3"
          >
            <div>
              <p className="text-sm font-black text-[#f8fafc]">{row.label}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {row.status}
              </p>
            </div>
            <span className="rounded-lg border border-black bg-surface-inset px-2.5 py-1 text-sm font-black tabular-nums text-[#f8fafc]">
              {row.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InventoryCustodyPanel({
  warehouseName,
  items,
  truckBalances,
  active,
}: {
  warehouseName?: string;
  items: InventoryStockItem[];
  truckBalances: ConductorTruckBalance[];
  active: boolean;
}) {
  const [kindTab, setKindTab] = useState<CustodyKindTab>("empty");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agencyRows, setAgencyRows] = useState<InventoryCustodyAgencyRow[]>([]);
  const [agencyModuleEnabled, setAgencyModuleEnabled] = useState(false);
  const [fullRows, setFullRows] = useState<InventoryCustodyFullCount[]>([]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setError("");
      void loadInventoryCustodySnapshotAction().then((result) => {
        if (cancelled) {
          return;
        }

        setLoading(false);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setAgencyRows(result.data.agencyRows);
        setAgencyModuleEnabled(result.data.agencyModuleEnabled);
        setFullRows(result.data.fullPackageCounts);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [active]);

  const emptyRows = useMemo(
    () =>
      buildInventoryCustodyEmptyRows({
        items,
        truckBalances,
        agencyRows,
      }),
    [agencyRows, items, truckBalances],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-black/70 px-4 py-3">
        <AppTabs
          tabs={custodyKindTabs}
          value={kindTab}
          onChange={setKindTab}
          size="compact"
          ariaLabel="Tipo de caja en custodia"
        />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-bold text-rose-300">{error}</p>
        </div>
      ) : kindTab === "empty" ? (
        <EmptyCustodyTable rows={emptyRows} warehouseName={warehouseName} agencyModuleEnabled={agencyModuleEnabled} />
      ) : (
        <FullCustodyList rows={fullRows} />
      )}
    </div>
  );
}
