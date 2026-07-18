"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Building2, CheckCircle2, Loader2, MapPin, WalletCards } from "lucide-react";
import { completeConductorAgencyVisitAction, listConductorAgencyVisitsAction, type AgencyDriverVisit } from "@/app/actions/agency-operations";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-methods";
import { agencyVisitCanClose } from "@/lib/agency-route-operations";
import { useNotify } from "@/hooks/use-notify";
import { Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

type VisitConfirmation = Record<string, { quantity: string; reason: string }>;

export function AgencyVisitsPanel({ driverId }: { driverId: string }) {
  const notify = useNotify();
  const [visits, setVisits] = useState<AgencyDriverVisit[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [payment, setPayment] = useState({ method: "cash", reference: "", selected: new Set<string>() });
  const [confirmation, setConfirmation] = useState<VisitConfirmation>({});

  const reload = useCallback(async () => {
    const result = await listConductorAgencyVisitsAction(driverId);
    if (result.ok) setVisits(result.data);
  }, [driverId]);

  useEffect(() => {
    const reloadTimer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(reloadTimer);
  }, [reload]);

  function lineConfirmation(line: AgencyDriverVisit["lines"][number]) {
    const current = confirmation[line.id];
    return { quantity: current?.quantity ?? String(line.requestedQuantity), reason: current?.reason ?? "" };
  }

  function updateLine(lineId: string, patch: Partial<{ quantity: string; reason: string }>) {
    setConfirmation((current) => ({
      ...current,
      [lineId]: { quantity: current[lineId]?.quantity ?? "", reason: current[lineId]?.reason ?? "", ...patch },
    }));
  }

  function toggleCharge(chargeId: string) {
    setPayment((current) => {
      const selected = new Set(current.selected);
      if (selected.has(chargeId)) selected.delete(chargeId);
      else selected.add(chargeId);
      return { ...current, selected };
    });
  }

  function closeVisit(visit: AgencyDriverVisit) {
    const lines = visit.lines.map((line) => {
      const value = lineConfirmation(line);
      return { visitLineId: line.id, confirmedQuantity: Number(value.quantity), differenceReason: value.reason };
    });
    if (lines.some((line, index) => !agencyVisitCanClose({ requested: visit.lines[index].requestedQuantity, confirmed: line.confirmedQuantity, differenceReason: line.differenceReason }))) {
      notify.error("Indica la cantidad real y el motivo cuando falte o sobre una caja.");
      return;
    }
    const applications = visit.charges
      .filter((charge) => payment.selected.has(charge.id))
      .map((charge) => ({ chargeId: charge.id, amountCents: charge.outstandingCents }));
    startTransition(async () => {
      const result = await completeConductorAgencyVisitAction({
        visitId: visit.id,
        lines,
        payment: applications.length
          ? {
              amountCents: applications.reduce((total, item) => total + item.amountCents, 0),
              method: payment.method,
              reference: payment.reference,
              applications,
            }
          : undefined,
      });
      if (!result.ok) return notify.error(result.error);
      notify.success(result.data.paymentId ? "Visita y pago registrados." : "Visita confirmada. El saldo queda pendiente.");
      setOpenId(null);
      setConfirmation({});
      setPayment({ method: "cash", reference: "", selected: new Set() });
      await reload();
    });
  }

  return (
    <Panel title="Agencias" action={<Building2 className="h-5 w-5 text-emerald-300" />}>
      <div className="grid gap-2">
        {visits.length ? visits.map((visit) => (
          <article key={visit.id} className="rounded-lg border border-black bg-surface-list-row p-3">
            <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpenId((current) => current === visit.id ? null : visit.id)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-200"><Building2 className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block font-black text-slate-100">{visit.agencyName}</span><span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-400"><MapPin className="h-3 w-3" />{visit.address}</span><span className="mt-1 block text-xs font-black text-emerald-300">{visit.routeName}</span></span>
            </button>
            {openId === visit.id ? <div className="mt-3 grid gap-3 border-t border-black pt-3">
              <div className="grid gap-2">{visit.lines.map((line) => {
                const value = lineConfirmation(line);
                const needsReason = Number(value.quantity) !== line.requestedQuantity;
                return <div key={line.id} className="grid gap-2 rounded-md bg-surface-inset px-3 py-2 text-sm font-bold text-slate-200 sm:grid-cols-[1fr_5rem_1fr] sm:items-center"><span>{line.label} <span className="text-xs text-slate-500">pedido: {line.requestedQuantity}</span></span><input className="h-9 rounded-md border border-black bg-surface-card px-2 text-center font-black text-emerald-200" type="number" min="0" value={value.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} />{needsReason ? <input className="h-9 rounded-md border border-black bg-surface-card px-2 text-xs text-slate-100" value={value.reason} onChange={(event) => updateLine(line.id, { reason: event.target.value })} placeholder="Motivo de diferencia" /> : <span className="text-xs text-emerald-300">Cantidad confirmada</span>}</div>;
              })}</div>
              <div className="rounded-md border border-black bg-surface-inset p-3"><p className="flex items-center gap-2 text-sm font-black text-slate-100"><WalletCards className="h-4 w-4 text-emerald-300" /> Cobros pendientes</p>{visit.charges.length ? <div className="mt-2 grid gap-1">{visit.charges.map((charge) => <label key={charge.id} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-300"><input type="checkbox" checked={payment.selected.has(charge.id)} onChange={() => toggleCharge(charge.id)} />{charge.label}: ${(charge.outstandingCents / 100).toFixed(2)}</label>)}</div> : <p className="mt-1 text-xs font-bold text-slate-500">La agencia puede pagar después.</p>}{payment.selected.size ? <div className="mt-2 grid gap-2 sm:grid-cols-2"><select className="h-9 rounded-md border border-black bg-surface-card px-2 text-sm font-black text-slate-100" value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>{PAYMENT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className="h-9 rounded-md border border-black bg-surface-card px-2 text-sm font-bold text-slate-100" value={payment.reference} onChange={(event) => setPayment((current) => ({ ...current, reference: event.target.value }))} placeholder="Referencia opcional" /></div> : null}</div>
              <div className="flex gap-2"><button type="button" className={primaryButtonClass} disabled={pending} onClick={() => closeVisit(visit)}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmar visita</button><button type="button" className={secondaryButtonClass} onClick={() => setOpenId(null)} disabled={pending}>Volver</button></div>
            </div> : null}
          </article>
        )) : <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">No tienes visitas de agencia en esta ruta.</p>}
      </div>
    </Panel>
  );
}
