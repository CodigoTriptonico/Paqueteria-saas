"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, BadgeDollarSign, Loader2, Save } from "lucide-react";
import { loadAgencyPublicPriceWorkspaceAction, saveAgencyPublicPricesAction, type AgencyPublicPriceWorkspace } from "@/app/actions/agency-public-pricing";
import { Panel, inputClass, primaryButtonClass, secondaryButtonClass, StatCard } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { agencyBoxMarginCents, agencyRateLineKey, formatUsdInput, parseUsdInputToCents } from "@/lib/agency-rate-admin";
import { formatUsdCents } from "@/lib/business/workspace";

type Drafts = Record<string, string>;

export function AgencyPublicPricePanel() {
  const notify = useNotify();
  const [data, setData] = useState<AgencyPublicPriceWorkspace | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadAgencyPublicPriceWorkspaceAction();
    setLoading(false);
    if (!result.ok) return notify.error(result.error);
    setData(result.data);
    setDrafts(Object.fromEntries(result.data.catalog.map((line) => [agencyRateLineKey(line.destinationCode, line.productCode), formatUsdInput(line.publicPriceCents)])));
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const groups = useMemo(() => {
    const countries = new Map<string, { name: string; code: string; lines: AgencyPublicPriceWorkspace["catalog"] }>();
    for (const line of data?.catalog || []) {
      const country = countries.get(line.destinationCode) || { name: line.destinationName, code: line.destinationCode, lines: [] };
      country.lines.push(line);
      countries.set(line.destinationCode, country);
    }
    return [...countries.values()];
  }, [data]);

  const profitableCount = useMemo(() => (data?.catalog || []).filter((line) => {
    const input = drafts[agencyRateLineKey(line.destinationCode, line.productCode)];
    try { return agencyBoxMarginCents(line.matrixRateCents, parseUsdInputToCents(input ?? "0")) >= 0; } catch { return false; }
  }).length, [data, drafts]);

  function marginFor(line: AgencyPublicPriceWorkspace["catalog"][number]) {
    try {
      return agencyBoxMarginCents(line.matrixRateCents, parseUsdInputToCents(drafts[agencyRateLineKey(line.destinationCode, line.productCode)] ?? "0"));
    } catch {
      return null;
    }
  }

  function save() {
    if (!data?.canManage) return;
    let lines: Array<{ destinationCode: string; productCode: string; amountCents: number }>;
    try {
      lines = data.catalog.map((line) => ({ destinationCode: line.destinationCode, productCode: line.productCode, amountCents: parseUsdInputToCents(drafts[agencyRateLineKey(line.destinationCode, line.productCode)] ?? "0") }));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Revisa los precios al público.");
      return;
    }
    startTransition(async () => {
      const result = await saveAgencyPublicPricesAction(lines);
      if (!result.ok) return notify.error(result.error);
      notify.success(`Precios al público v${result.data.version} guardados.`);
      await reload();
    });
  }

  if (loading && !data) return <div className="mx-auto flex w-full max-w-[1500px] items-center gap-2 p-5 text-sm font-bold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Cargando precios...</div>;
  if (!data) return <div className="mx-auto w-full max-w-[1500px] p-5"><Link href="/agencia" className={secondaryButtonClass}><ArrowLeft className="h-4 w-4" /> Mi agencia</Link></div>;

  return <div className="mx-auto w-full max-w-[1500px] space-y-4 p-3 sm:p-5">
    <Link href="/agencia" className={`${secondaryButtonClass} w-fit`}><ArrowLeft className="h-4 w-4" /> Mi agencia</Link>
    <header className="rounded-xl border border-black bg-surface-shell p-4 sm:p-5"><div className="flex flex-wrap items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-700 bg-emerald-400 text-slate-950"><BadgeDollarSign className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Precios de mi agencia</p><h1 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">{data.agencyName}</h1><p className="mt-1 max-w-3xl text-sm font-bold text-slate-300">Revisa lo que le debes a la matriz, elige tu precio al público y mira tu ganancia por cada caja.</p></div></div></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Tarifa de la matriz" value={data.internalRateVersion ? `v${data.internalRateVersion.version}` : "Sin tarifa"} tone="text-amber-300" /><StatCard label="Precio al público" value={data.publicPriceVersion ? `v${data.publicPriceVersion.version}` : "Sin configurar"} tone="text-emerald-300" /><StatCard label="Cajas sin pérdida" value={`${profitableCount} / ${data.catalog.length}`} tone="text-slate-100" /></section>
    <Panel title="Precios y ganancia por caja" action={data.canManage ? <button type="button" className={primaryButtonClass} onClick={save} disabled={pending || !data.catalog.length}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar precios</button> : <span className="text-xs font-bold text-slate-400">Solo lectura</span>}>
      {!data.catalog.length ? <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">La matriz todavía no tiene cajas configuradas para mostrar.</p> : <div className="grid gap-4">{groups.map((country) => <section key={country.code} className="overflow-hidden rounded-lg border border-black bg-surface-inset/40"><div className="flex items-center justify-between gap-3 border-b border-black bg-surface-card-header px-3 py-2"><h2 className="font-black text-slate-100">{country.name}</h2><span className="text-xs font-black uppercase text-emerald-300">{country.code}</span></div><div className="divide-y divide-black">{country.lines.map((line) => { const key = agencyRateLineKey(line.destinationCode, line.productCode); const margin = marginFor(line); return <div key={key} className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_10rem_13rem_10rem] lg:items-center"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-100">{line.productName}</p><p className="text-xs font-bold text-slate-500">La matriz recibe {formatUsdCents(line.matrixRateCents)} por esta caja.</p></div><div><p className="text-[10px] font-black uppercase text-slate-500">Costo matriz</p><p className="font-black text-amber-200">{formatUsdCents(line.matrixRateCents)}</p></div><label className="relative"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Precio al público</span><span className="pointer-events-none absolute bottom-[0.65rem] left-3 text-sm font-black text-slate-400">USD</span><input aria-label={`Precio público de ${line.productName} para ${country.name}`} inputMode="decimal" className={`${inputClass} w-full pl-12`} value={drafts[key] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} disabled={!data.canManage || pending} /></label><div><p className="text-[10px] font-black uppercase text-slate-500">Ganancia por caja</p><p className={`font-black ${margin === null ? "text-slate-500" : margin < 0 ? "text-rose-300" : "text-emerald-300"}`}>{margin === null ? "Monto inválido" : formatUsdCents(margin)}</p></div></div>; })}</div></section>)}</div>}
    </Panel>
  </div>;
}
