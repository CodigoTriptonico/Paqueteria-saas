"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getSellerSalesDetailAction,
  type SellerSalesDetailReport,
} from "@/app/actions/seller-metrics";
import { CountryName } from "@/components/country-flag";
import { historyDateLabel } from "@/components/sale/venta-parts";
import { Panel, StatCard, textMutedClass } from "@/components/ui-blocks";
import { formatMoneyValue } from "@/lib/logistics-fees";
import type { PeriodGranularity } from "@/lib/seller-metrics/period-buckets";
import { invoiceStatusLabel, shipmentStatusDisplayLabel } from "@/lib/shipment-display";
import type { ShipmentStatus } from "@/app/actions/shipments";

type SellerSalesDetailPanelProps = {
  sellerId: string;
  sellerName: string;
  granularity: PeriodGranularity;
  anchorDate: string;
  rangeFrom?: string;
  rangeTo?: string;
  periodLabel: string;
};

function saleKindLabel(saleKind: string) {
  return saleKind === "empty_box_deposit" ? "Depósito caja" : "Envío completo";
}

export function SellerSalesDetailPanel({
  sellerId,
  sellerName,
  granularity,
  anchorDate,
  rangeFrom,
  rangeTo,
  periodLabel,
}: SellerSalesDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<SellerSalesDetailReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        setError("");

        const result = await getSellerSalesDetailAction({
          salesOwnerId: sellerId,
          sellerName,
          granularity,
          anchorDate: granularity === "range" ? null : anchorDate,
          rangeFrom: granularity === "range" ? rangeFrom || null : null,
          rangeTo: granularity === "range" ? rangeTo || null : null,
        });

        if (cancelled) {
          return;
        }

        setLoading(false);

        if (!result.ok) {
          setError(result.error);
          setReport(null);
          return;
        }

        setReport(result.data);
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [anchorDate, granularity, rangeFrom, rangeTo, sellerId, sellerName]);

  const totals = report?.totals;

  return (
    <Panel title={sellerName} hideHeader clipContent={false} contentClassName="p-0">
      <div className="space-y-4 p-4 sm:p-5">
        <p className={textMutedClass}>{periodLabel}</p>

        {totals ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Ventas" value={String(totals.saleCount)} tone="text-emerald-300" />
            <StatCard label="Abiertas" value={String(totals.openCount)} tone="text-amber-300" />
            <StatCard
              label="Cobrado"
              value={formatMoneyValue(totals.totalPaid)}
              tone="text-sky-300"
            />
            <StatCard
              label="Utilidad"
              value={formatMoneyValue(totals.totalProfit)}
              tone="text-rose-300"
            />
          </div>
        ) : null}

        {loading ? <p className={textMutedClass}>Cargando ventas...</p> : null}
        {error ? (
          <p className="rounded-lg border border-rose-600 bg-rose-400/10 px-3 py-2 text-sm font-black text-rose-200">
            {error}
          </p>
        ) : null}

        {!loading && !error && report && !report.sales.length ? (
          <p className="rounded-xl border border-black bg-surface-inset px-4 py-8 text-center text-sm font-black text-slate-400">
            Sin ventas en este periodo
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report?.sales.map((row) => (
            <Link
              key={row.id}
              href={`/seguimiento?q=${encodeURIComponent(row.code)}`}
              className="rounded-xl border border-black bg-surface-card p-3 transition hover:border-emerald-700/40 hover:bg-surface-card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#f8fafc]">{row.code}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-400">
                    {historyDateLabel(row.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${
                    row.invoiceStatus === "paid"
                      ? "border-emerald-600/40 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-600/40 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {invoiceStatusLabel(row.invoiceStatus as "open" | "paid" | "void")}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-xs font-bold text-slate-300">
                <p className="truncate">{row.customerName}</p>
                <p className="flex items-center gap-1 text-slate-400">
                  <CountryName
                    name={row.country}
                    size="xs"
                    labelClassName="text-xs font-bold text-slate-400"
                  />
                  <span>· {saleKindLabel(row.saleKind)}</span>
                </p>
                <p>
                  Cobrado: {formatMoneyValue(row.paid)}
                  {row.profit > 0 ? ` · Utilidad: ${formatMoneyValue(row.profit)}` : null}
                </p>
                <p className="text-slate-400">
                  Estado envío: {shipmentStatusDisplayLabel(row.status as ShipmentStatus)}
                </p>
                {row.recipientName ? (
                  <p className="text-slate-400">Destinatario: {row.recipientName}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Panel>
  );
}
