"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, CircleDollarSign, Loader2, Save } from "lucide-react";
import { loadAgencyInternalRateAdminAction, saveAgencyInternalRatesAction, type AgencyRateAdminData } from "@/app/actions/agency-pricing";
import { Panel, inputClass, primaryButtonClass, secondaryButtonClass, StatCard } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { agencyRateLineKey, formatUsdInput, parseUsdInputToCents } from "@/lib/agency-rate-admin";
import { formatUsdCents } from "@/lib/business/workspace";

type Drafts = Record<string, string>;

function statusLabel(status: string) {
  return status === "active" ? "Activa" : status.replaceAll("_", " ");
}

export function AgencyRateAdminPanel({ agencyId }: { agencyId: string }) {
  const notify = useNotify();
  const [data, setData] = useState<AgencyRateAdminData | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadAgencyInternalRateAdminAction(agencyId);
    setLoading(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setData(result.data);
    setDrafts(Object.fromEntries(result.data.catalog.map((line) => [
      agencyRateLineKey(line.destinationCode, line.productCode),
      formatUsdInput(line.amountCents),
    ])));
  }, [agencyId, notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const byCountry = useMemo(() => {
    const countries = new Map<string, { code: string; name: string; lines: AgencyRateAdminData["catalog"] }>();
    for (const line of data?.catalog || []) {
      const existing = countries.get(line.destinationCode) || { code: line.destinationCode, name: line.destinationName, lines: [] };
      existing.lines.push(line);
      countries.set(line.destinationCode, existing);
    }
    return [...countries.values()];
  }, [data]);

  function save() {
    if (!data) return;
    let lines: Array<{ destinationCode: string; productCode: string; amountCents: number }>;
    try {
      lines = data.catalog.map((line) => ({
        destinationCode: line.destinationCode,
        productCode: line.productCode,
        amountCents: parseUsdInputToCents(drafts[agencyRateLineKey(line.destinationCode, line.productCode)] ?? "0"),
      }));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Revisa los montos de la tarifa.");
      return;
    }
    startTransition(async () => {
      const result = await saveAgencyInternalRatesAction({ agencyId, lines });
      if (!result.ok) return notify.error(result.error);
      notify.success(`Tarifa v${result.data.version} guardada: ${result.data.linesSaved} cajas.`);
      await reload();
    });
  }

  if (loading && !data) {
    return <div className="mx-auto flex w-full max-w-[1500px] items-center gap-2 p-5 text-sm font-bold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Cargando agencia...</div>;
  }

  if (!data) {
    return <div className="mx-auto w-full max-w-[1500px] p-5"><Link href="/agencias" className={secondaryButtonClass}><ArrowLeft className="h-4 w-4" /> Volver a agencias</Link></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 p-3 sm:p-5">
      <Link href="/agencias" className={`${secondaryButtonClass} w-fit`}><ArrowLeft className="h-4 w-4" /> Agencias</Link>
      <header className="rounded-xl border border-black bg-surface-shell p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-700 bg-emerald-400 text-slate-950"><CircleDollarSign className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wider text-emerald-300">{data.agency.code} · {statusLabel(data.agency.status)}</p><h1 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">{data.agency.name}</h1><p className="mt-1 max-w-3xl text-sm font-bold text-slate-300">Define cuánto paga esta agencia a la matriz por cada caja vendida. No cambia el precio que cobra a sus clientes.</p></div>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Saldo pendiente" value={formatUsdCents(data.agency.balanceCents)} tone="text-amber-300" />
        <StatCard label="Tarifa activa" value={data.version ? `v${data.version.version}` : "Sin tarifa"} tone="text-emerald-300" />
        <StatCard label="Cajas configurables" value={String(data.catalog.length)} tone="text-slate-100" />
      </section>
      <Panel title="Lo que esta agencia paga a la matriz por cada caja" action={<button type="button" className={primaryButtonClass} onClick={save} disabled={pending || !data.catalog.length}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar tarifas</button>}>
        {!data.catalog.length ? <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">Primero agrega países y cajas en Configuración. Aquí aparecerán automáticamente.</p> : <div className="grid gap-4">
          {byCountry.map((country) => <section key={country.code} className="overflow-hidden rounded-lg border border-black bg-surface-inset/40">
            <div className="flex items-center justify-between gap-3 border-b border-black bg-surface-card-header px-3 py-2"><h2 className="font-black text-slate-100">{country.name}</h2><span className="text-xs font-black uppercase text-emerald-300">{country.code}</span></div>
            <div className="divide-y divide-black">{country.lines.map((line) => {
              const key = agencyRateLineKey(line.destinationCode, line.productCode);
              return <label key={key} className="grid items-center gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_13rem]"><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-100">{line.productName}</span><span className="block text-xs font-bold text-slate-500">La agencia paga a la matriz por cada caja</span></span><span className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">USD</span><input aria-label={`Tarifa de ${line.productName} para ${country.name}`} inputMode="decimal" className={`${inputClass} w-full pl-12`} value={drafts[key] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} disabled={pending} /></span></label>;
            })}</div>
          </section>)}
        </div>}
      </Panel>
    </div>
  );
}
