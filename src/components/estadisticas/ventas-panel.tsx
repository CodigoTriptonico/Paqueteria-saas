"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Crown, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";
import { getSellerMetricsAction, type SellerMetricsReport } from "@/app/actions/seller-metrics";
import { SellerSalesDetailPanel } from "@/components/estadisticas/seller-sales-detail-panel";
import { PeriodRangeToolbar } from "@/components/estadisticas/period-range-toolbar";
import { useNotify } from "@/components/notifications/notification-provider";
import { Panel, StatCard, textMutedClass } from "@/components/ui-blocks";
import { formatMoneyValue } from "@/lib/logistics-fees";
import type { PeriodGranularity } from "@/lib/seller-metrics/period-buckets";
import { anchorDateKey, defaultRangeKeys, shiftAnchor } from "@/lib/seller-metrics/period-buckets";

const PERIOD_OPTIONS: { value: PeriodGranularity; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "range", label: "Rango" },
];

const navButtonClass =
  "inline-flex h-full w-10 shrink-0 items-center justify-center text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:opacity-50";

function formatPercent(value: number) {
  if (value <= 0) {
    return "0%";
  }

  if (value >= 10) {
    return `${Math.round(value)}%`;
  }

  return `${value.toFixed(1)}%`;
}

function rankTone(rank: number, total: number) {
  if (total <= 1) {
    return "text-[#f8fafc]";
  }

  if (rank === 1) {
    return "text-emerald-300";
  }

  if (rank === total) {
    return "text-rose-300";
  }

  return "text-[#f8fafc]";
}

type EstadisticasVentasPanelProps = {
  initialReport?: SellerMetricsReport;
  initialError?: string;
};

export function EstadisticasVentasPanel({
  initialReport,
  initialError,
}: EstadisticasVentasPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const sellerId = searchParams.get("seller");
  const sellerName = searchParams.get("sellerName") || "";
  const urlGranularity = searchParams.get("granularity");
  const urlAnchor = searchParams.get("anchor");
  const urlRangeFrom = searchParams.get("from");
  const urlRangeTo = searchParams.get("to");
  const [report, setReport] = useState<SellerMetricsReport | undefined>(initialReport);
  const [granularity, setGranularity] = useState<PeriodGranularity>(
    (urlGranularity as PeriodGranularity) || initialReport?.granularity || "day",
  );
  const [anchorDate, setAnchorDate] = useState(
    urlAnchor || initialReport?.anchorDate || new Date().toISOString().slice(0, 10),
  );
  const initialRange = defaultRangeKeys(new Date(`${anchorDate}T12:00:00`));
  const [rangeFrom, setRangeFrom] = useState(
    urlRangeFrom || initialReport?.rangeFrom || initialRange.from,
  );
  const [rangeTo, setRangeTo] = useState(urlRangeTo || initialReport?.rangeTo || initialRange.to);
  const [error, setError] = useState(initialError || "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    queueMicrotask(() => {
      if (
        urlGranularity === "day" ||
        urlGranularity === "week" ||
        urlGranularity === "month" ||
        urlGranularity === "range"
      ) {
        setGranularity(urlGranularity);
      }

      if (urlAnchor) {
        setAnchorDate(urlAnchor);
      }

      if (urlRangeFrom) {
        setRangeFrom(urlRangeFrom);
      }

      if (urlRangeTo) {
        setRangeTo(urlRangeTo);
      }
    });
  }, [urlAnchor, urlGranularity, urlRangeFrom, urlRangeTo]);

  function buildVentasUrl(input: {
    seller?: { id: string; name: string } | null;
    nextGranularity?: PeriodGranularity;
    nextAnchorDate?: string;
    nextRangeFrom?: string;
    nextRangeTo?: string;
  }) {
    const params = new URLSearchParams();
    const nextGranularity = input.nextGranularity || granularity;
    params.set("view", "ventas");
    params.set("granularity", nextGranularity);

    if (nextGranularity === "range") {
      params.set("from", input.nextRangeFrom || rangeFrom);
      params.set("to", input.nextRangeTo || rangeTo);
    } else {
      params.set("anchor", input.nextAnchorDate || anchorDate);
    }

    if (input.seller) {
      params.set("seller", input.seller.id);
      params.set("sellerName", input.seller.name);
    }

    return `/estadisticas?${params.toString()}`;
  }

  function openSellerDetail(salesOwnerId: string, salesOwnerName: string) {
    router.replace(
      buildVentasUrl({
        seller: { id: salesOwnerId, name: salesOwnerName },
      }),
      { scroll: false },
    );
  }

  const loadReport = useCallback(
    (
      nextGranularity: PeriodGranularity,
      nextAnchorDate: string,
      nextRangeFrom?: string,
      nextRangeTo?: string,
    ) => {
      startTransition(async () => {
        const result = await getSellerMetricsAction({
          granularity: nextGranularity,
          anchorDate: nextGranularity === "range" ? null : nextAnchorDate,
          rangeFrom: nextGranularity === "range" ? nextRangeFrom || rangeFrom : null,
          rangeTo: nextGranularity === "range" ? nextRangeTo || rangeTo : null,
        });

        if (!result.ok) {
          setError(result.error);
          notify.error(result.error);
          return;
        }

        setError("");
        setReport(result.data);
        setGranularity(nextGranularity);
        setAnchorDate(result.data.anchorDate);
        if (result.data.rangeFrom) {
          setRangeFrom(result.data.rangeFrom);
        }
        if (result.data.rangeTo) {
          setRangeTo(result.data.rangeTo);
        }
      });
    },
    [notify, rangeFrom, rangeTo],
  );

  const topSeller = report?.sellers.find((row) => row.saleCount > 0);
  const lowestActiveSeller = useMemo(() => {
    if (!report) {
      return undefined;
    }

    const active = report.sellers.filter((row) => row.saleCount > 0);
    return active[active.length - 1];
  }, [report]);

  const maxDailyPaid = useMemo(() => {
    if (!report) {
      return 0;
    }

    return report.dailyBreakdown.reduce((max, row) => Math.max(max, row.totalPaid), 0);
  }, [report]);

  function changeGranularity(next: PeriodGranularity) {
    if (next === granularity && report) {
      return;
    }

    if (next === "range") {
      const fallback = defaultRangeKeys(new Date(`${anchorDate}T12:00:00`));
      const nextFrom = rangeFrom || fallback.from;
      const nextTo = rangeTo || fallback.to;
      setRangeFrom(nextFrom);
      setRangeTo(nextTo);
      router.replace(
        buildVentasUrl({
          nextGranularity: next,
          nextRangeFrom: nextFrom,
          nextRangeTo: nextTo,
        }),
        { scroll: false },
      );
      loadReport(next, anchorDate, nextFrom, nextTo);
      return;
    }

    loadReport(next, anchorDate);
  }

  function applyRange(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) {
      return;
    }

    if (nextFrom === rangeFrom && nextTo === rangeTo) {
      return;
    }

    setRangeFrom(nextFrom);
    setRangeTo(nextTo);
    router.replace(
      buildVentasUrl({
        nextGranularity: "range",
        nextRangeFrom: nextFrom,
        nextRangeTo: nextTo,
      }),
      { scroll: false },
    );
    loadReport("range", anchorDate, nextFrom, nextTo);
  }

  function shiftPeriod(delta: -1 | 1) {
    if (granularity === "range") {
      return;
    }

    const nextAnchor = shiftAnchor(new Date(`${anchorDate}T12:00:00`), granularity, delta);
    const nextAnchorDate = `${nextAnchor.getFullYear()}-${String(nextAnchor.getMonth() + 1).padStart(2, "0")}-${String(nextAnchor.getDate()).padStart(2, "0")}`;
    router.replace(buildVentasUrl({ nextAnchorDate }), { scroll: false });
    loadReport(granularity, nextAnchorDate);
  }

  const todayKey = anchorDateKey(new Date());
  const isCurrentPeriod =
    granularity === "range" ? rangeFrom === todayKey && rangeTo === todayKey : anchorDate === todayKey;

  function goToToday() {
    if (isCurrentPeriod) {
      return;
    }

    if (granularity === "range") {
      applyRange(todayKey, todayKey);
      return;
    }

    router.replace(buildVentasUrl({ nextAnchorDate: todayKey }), { scroll: false });
    loadReport(granularity, todayKey);
  }

  if (sellerId) {
    return (
      <SellerSalesDetailPanel
        sellerId={sellerId}
        sellerName={sellerName}
        granularity={granularity}
        anchorDate={anchorDate}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        periodLabel={report?.periodLabel || ""}
      />
    );
  }

  return (
    <Panel title="Ventas" hideHeader clipContent={false} contentClassName="p-0">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-xl border border-black bg-surface-card-header p-2">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex h-9 shrink-0 divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset"
              role="group"
              aria-label="Tipo de periodo"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => changeGranularity(option.value)}
                  aria-pressed={granularity === option.value}
                  className={`min-w-[4.5rem] px-3 text-xs font-black transition disabled:opacity-50 ${
                    granularity === option.value
                      ? "bg-emerald-400 text-slate-950"
                      : "text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div
              className={`flex h-9 min-w-[15rem] flex-[1_1_16rem] items-stretch overflow-hidden rounded-lg border border-black bg-surface-inset sm:max-w-[20rem] ${
                granularity === "range" ? "hidden" : ""
              }`}
            >
              <button
                type="button"
                className={navButtonClass}
                disabled={isPending}
                onClick={() => shiftPeriod(-1)}
                aria-label="Periodo anterior"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </button>
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center border-x border-black px-3 text-center">
                <span className="text-[9px] font-black uppercase leading-none text-slate-500">
                  {granularity === "day" ? "Día" : granularity === "week" ? "Semana" : "Mes"}
                </span>
                <span className="mt-1 truncate text-sm font-black leading-none text-[#f8fafc]">
                  {report?.periodLabel || "..."}
                </span>
              </div>
              <button
                type="button"
                className={navButtonClass}
                disabled={isPending}
                onClick={() => shiftPeriod(1)}
                aria-label="Periodo siguiente"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            {granularity === "range" ? (
              <PeriodRangeToolbar
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                disabled={isPending}
                onApply={applyRange}
              />
            ) : null}

            <button
              type="button"
              disabled={isPending || isCurrentPeriod}
              onClick={goToToday}
              className={`h-9 shrink-0 rounded-lg border border-black px-3 text-xs font-black transition disabled:opacity-50 ${
                isCurrentPeriod
                  ? "bg-emerald-400 text-slate-950"
                  : "bg-surface-inset text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc]"
              }`}
            >
              Hoy
            </button>

            {report ? (
              <div className="flex h-9 shrink-0 divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset">
                <div className="flex min-w-[5rem] items-center gap-1.5 px-2.5">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">Ventas</span>
                  <span className="text-sm font-black tabular-nums leading-none text-emerald-300">
                    {report.totals.saleCount}
                  </span>
                </div>
                <div className="flex min-w-[5rem] items-center gap-1.5 px-2.5">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">Abiertas</span>
                  <span className="text-sm font-black tabular-nums leading-none text-amber-300">
                    {report.totals.openCount}
                  </span>
                </div>
                <div className="flex min-w-[6.5rem] items-center gap-1.5 px-2.5">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">Cobrado</span>
                  <span className="text-sm font-black tabular-nums leading-none text-sky-300">
                    {formatMoneyValue(report.totals.totalPaid)}
                  </span>
                </div>
              </div>
            ) : null}

            {isPending ? (
              <span className="inline-flex h-9 items-center gap-2 px-2 text-xs font-black text-slate-400">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Actualizando
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-600 bg-rose-400/10 px-3 py-2 text-sm font-black text-rose-200">
            {error}
          </p>
        ) : null}

        {report ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Ventas registradas"
                value={String(report.totals.saleCount)}
                tone="text-emerald-300"
              />
              <StatCard
                label="Abiertas"
                value={String(report.totals.openCount)}
                tone="text-amber-300"
              />
              <StatCard
                label="Total cobrado"
                value={formatMoneyValue(report.totals.totalPaid)}
                tone="text-sky-300"
              />
              <StatCard
                label="Utilidad cerrada"
                value={formatMoneyValue(report.totals.totalProfit)}
                tone="text-rose-300"
              />
              <StatCard
                label="Vendedores activos"
                value={String(report.totals.activeSellers)}
                tone="text-[#f8fafc]"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <section className="overflow-hidden rounded-xl border border-black bg-surface-card">
                <div className="border-b border-black bg-surface-card-header px-4 py-3">
                  <h2 className="text-sm font-black text-[#f8fafc]">Ranking por vendedor</h2>
                  <p className={textMutedClass}>
                    Ordenado por ventas registradas. Toca un vendedor para ver sus invoices.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-black bg-surface-inset text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Vendedor</th>
                        <th className="px-3 py-2 text-right">Ventas</th>
                        <th className="px-3 py-2 text-right">Abiertas</th>
                        <th className="px-3 py-2 text-right">Cobrado</th>
                        <th className="px-3 py-2 text-right">Utilidad</th>
                        <th className="px-3 py-2 text-right">Promedio</th>
                        <th className="px-3 py-2 text-right">Participación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sellers.map((row) => (
                        <tr
                          key={row.salesOwnerId}
                          className="cursor-pointer border-b border-black/70 transition last:border-b-0 hover:bg-surface-card-hover"
                          onClick={() => openSellerDetail(row.salesOwnerId, row.salesOwnerName)}
                        >
                          <td className={`px-3 py-3 font-black ${rankTone(row.rank, report.sellers.length)}`}>
                            {row.rank}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {row.rank === 1 && row.saleCount > 0 ? (
                                <Crown className="h-4 w-4 shrink-0 text-emerald-300" />
                              ) : null}
                              <div className="min-w-0">
                                <p className="truncate font-black text-[#f8fafc]">
                                  {row.salesOwnerName}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500">
                                  {row.closedCount} cerradas · {row.openCount} abiertas ·{" "}
                                  {row.fullSales} completas · {row.depositSales} depósitos
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-black text-[#f8fafc]">
                            {row.saleCount}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-amber-300">
                            {row.openCount}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-emerald-300">
                            {formatMoneyValue(row.totalPaid)}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-rose-300">
                            {formatMoneyValue(row.totalProfit)}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-slate-300">
                            {formatMoneyValue(row.averageTicket)}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-sky-300">
                            {formatPercent(row.sharePercent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-black bg-surface-card">
                <div className="border-b border-black bg-surface-card-header px-4 py-3">
                  <h2 className="text-sm font-black text-[#f8fafc]">Resumen rápido</h2>
                </div>
                <div className="space-y-3 p-4">
                  {topSeller ? (
                    <div className="rounded-lg border border-black bg-surface-inset p-3">
                      <div className="flex items-center gap-2 text-emerald-300">
                        <TrendingUp className="h-4 w-4" />
                        <p className="text-xs font-black uppercase">Mejor vendedor</p>
                      </div>
                      <p className="mt-2 text-lg font-black text-[#f8fafc]">
                        {topSeller.salesOwnerName}
                      </p>
                      <p className="text-sm font-bold text-slate-400">
                        {topSeller.saleCount} ventas · {formatMoneyValue(topSeller.totalPaid)} cobrados
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-black bg-surface-inset p-3 text-sm font-bold text-slate-400">
                      Sin ventas registradas en este periodo.
                    </div>
                  )}

                  {lowestActiveSeller &&
                  report.totals.activeSellers > 1 &&
                  lowestActiveSeller.salesOwnerId !== topSeller?.salesOwnerId ? (
                    <div className="rounded-lg border border-black bg-surface-inset p-3">
                      <div className="flex items-center gap-2 text-rose-300">
                        <TrendingDown className="h-4 w-4" />
                        <p className="text-xs font-black uppercase">Menor producción</p>
                      </div>
                      <p className="mt-2 text-lg font-black text-[#f8fafc]">
                        {lowestActiveSeller.salesOwnerName}
                      </p>
                      <p className="text-sm font-bold text-slate-400">
                        {lowestActiveSeller.saleCount} ventas ·{" "}
                        {formatMoneyValue(lowestActiveSeller.totalPaid)} cobrados
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            {granularity !== "day" ? (
              <section className="overflow-hidden rounded-xl border border-black bg-surface-card">
                <div className="border-b border-black bg-surface-card-header px-4 py-3">
                  <h2 className="text-sm font-black text-[#f8fafc]">Desglose diario</h2>
                  <p className={textMutedClass}>
                    Ventas registradas por día en el periodo seleccionado.
                  </p>
                </div>
                <div className="divide-y divide-black/70">
                  {report.dailyBreakdown.map((row) => {
                    const width =
                      maxDailyPaid > 0 ? Math.max((row.totalPaid / maxDailyPaid) * 100, 0) : 0;

                    return (
                      <div
                        key={row.dayKey}
                        className="grid gap-3 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_5rem] sm:items-center"
                      >
                        <p className="text-xs font-black uppercase text-slate-500">{row.label}</p>
                        <div className="h-3 overflow-hidden rounded-full border border-black bg-surface-inset">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-300">
                            {formatMoneyValue(row.totalPaid)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500">
                            {row.saleCount} ventas · {row.openCount} abiertas
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <p className={textMutedClass}>Cargando escrutinio...</p>
        )}
      </div>
    </Panel>
  );
}
