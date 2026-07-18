"use client";

import { CheckCircle2, CircleDollarSign, LockKeyhole } from "lucide-react";
import { useState, useTransition } from "react";
import { finalizeAgencyDailyCloseAction, prepareAgencyDailyCloseAction, type AgencyDailyClose } from "@/app/actions/controlled-operations";
import { Panel, inputClass, primaryButtonClass, secondaryButtonClass, StatCard } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { closeDifferenceMessage } from "@/lib/controlled-operations";

function dollarsFromCents(cents: number) { return (cents / 100).toFixed(2); }
function centsFromDollars(value: string) { return Math.round((Number(value.replace(",", ".")) || 0) * 100); }

export function AgencyDailyCloseClient({ initialClose, canPrepare, canFinalize }: { initialClose: AgencyDailyClose | null; canPrepare: boolean; canFinalize: boolean }) {
  const notify = useNotify();
  const [close, setClose] = useState(initialClose);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(initialClose?.operatingDate || new Date().toISOString().slice(0, 10));
  const [cash, setCash] = useState(initialClose ? dollarsFromCents(initialClose.countedCashCents) : "");
  const [reason, setReason] = useState(initialClose?.differenceReason || "");
  const expected = close?.expectedCashCents ?? 0;
  const counted = centsFromDollars(cash);
  const difference = counted - expected;

  function prepare() {
    startTransition(async () => {
      const result = await prepareAgencyDailyCloseAction({ operatingDate: date, countedCashCents: counted, differenceReason: reason });
      if (!result.ok) return notify.error(result.error);
      setClose(result.data); notify.success("Cierre preparado. Otro administrador de la agencia debe validarlo.");
    });
  }

  function finalize() {
    if (!close) return;
    startTransition(async () => {
      const result = await finalizeAgencyDailyCloseAction(close.id);
      if (!result.ok) return notify.error(result.error);
      setClose((current) => current ? { ...current, status: "closed", finalizedAt: new Date().toISOString() } : current);
      notify.success("Día congelado. Las correcciones posteriores deberán ser reversos.");
    });
  }

  const summary = close?.summary || {};
  return <div className="mx-auto w-full max-w-[1200px] space-y-4 p-3 sm:p-5"><header className="rounded-xl border border-black bg-surface-shell p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-700 bg-emerald-400 text-slate-950"><LockKeyhole className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-wider text-emerald-300">Agencia</p><h1 className="text-2xl font-black text-slate-50">Cierre diario</h1><p className="mt-1 text-sm font-bold text-slate-300">Cuadra lo vendido, cobrado, movido y pendiente. La matriz no aprueba la cartera de tus clientes.</p></div></div></header><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Ventas" value={String(summary.salesCount || 0)} tone="text-slate-100" /><StatCard label="Pagos de clientes" value={`$${dollarsFromCents(Number(summary.customerPaymentsCents || 0))}`} tone="text-emerald-300" /><StatCard label="Custodia pendiente" value={String(summary.pendingCustody || 0)} tone={summary.pendingCustody ? "text-amber-300" : "text-emerald-300"} /><StatCard label="Excepciones abiertas" value={String(summary.openExceptions || 0)} tone={summary.openExceptions ? "text-amber-300" : "text-emerald-300"} /></section><Panel title="Contar caja" action={<CircleDollarSign className="h-5 w-5 text-emerald-300" />}><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-black uppercase text-slate-500">Día operativo<input type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} disabled={close?.status === "closed"} /></label><label className="grid gap-1 text-xs font-black uppercase text-slate-500">Efectivo contado (USD)<input inputMode="decimal" className={inputClass} value={cash} onChange={(event) => setCash(event.target.value)} placeholder="0.00" disabled={close?.status === "closed"} /></label><div className="rounded-lg border border-black bg-surface-inset p-3 sm:col-span-2"><p className="text-xs font-black uppercase text-slate-500">Efectivo esperado</p><p className="mt-1 text-xl font-black text-slate-100">${dollarsFromCents(expected)}</p><p className={`mt-1 text-sm font-bold ${difference === 0 ? "text-emerald-300" : "text-amber-300"}`}>{closeDifferenceMessage(expected, counted)}</p></div>{difference !== 0 ? <textarea className={`${inputClass} min-h-20 sm:col-span-2`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica la diferencia antes de preparar el cierre" disabled={close?.status === "closed"} /> : null}</div><div className="mt-4 flex flex-wrap gap-2">{canPrepare && close?.status !== "closed" ? <button type="button" className={`${secondaryButtonClass} h-10`} disabled={pending || !date || (difference !== 0 && !reason.trim())} onClick={prepare}>Preparar cierre</button> : null}{canFinalize && close?.status === "prepared" ? <button type="button" className={`${primaryButtonClass} h-10`} disabled={pending} onClick={finalize}><CheckCircle2 className="h-4 w-4" />Validar y congelar</button> : null}{close?.status === "closed" ? <p className="flex items-center gap-2 text-sm font-black text-emerald-300"><CheckCircle2 className="h-4 w-4" />Cerrado. Solo se permiten reversos posteriores.</p> : null}</div></Panel></div>;
}
