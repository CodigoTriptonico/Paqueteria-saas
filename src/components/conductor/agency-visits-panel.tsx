"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Building2, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { completeConductorAgencyVisitAction, listConductorAgencyVisitsAction, type AgencyDriverVisit } from "@/app/actions/agency-operations";
import { agencyVisitCanClose } from "@/lib/agency-route-operations";
import { useNotify } from "@/hooks/use-notify";
import { Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

type VisitConfirmation = Record<string, { quantity: string; reason: string }>;

export function AgencyVisitsPanel({ driverId }: { driverId: string }) {
  const notify = useNotify();
  const [visits, setVisits] = useState<AgencyDriverVisit[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<VisitConfirmation>({});

  const reload = useCallback(async () => {
    const result = await listConductorAgencyVisitsAction(driverId);
    if (result.ok) setVisits(result.data);
  }, [driverId]);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  function lineConfirmation(line: AgencyDriverVisit["lines"][number]) {
    const current = confirmation[line.id];
    return { quantity: current?.quantity ?? String(line.requestedQuantity), reason: current?.reason ?? "" };
  }

  function updateLine(lineId: string, patch: Partial<{ quantity: string; reason: string }>) {
    setConfirmation((current) => ({ ...current, [lineId]: { quantity: current[lineId]?.quantity ?? "", reason: current[lineId]?.reason ?? "", ...patch } }));
  }

  function closeVisit(visit: AgencyDriverVisit) {
    const lines = visit.lines.map((line) => { const value = lineConfirmation(line); return { visitLineId: line.id, confirmedQuantity: Number(value.quantity), differenceReason: value.reason, evidence: { source: "driver_confirmation", serviceCode: line.serviceCode } }; });
    if (lines.some((line, index) => !agencyVisitCanClose({ requested: visit.lines[index].requestedQuantity, confirmed: line.confirmedQuantity, differenceReason: line.differenceReason }))) {
      notify.error("Indica la cantidad real y el motivo cuando exista una diferencia."); return;
    }
    startTransition(async () => {
      const result = await completeConductorAgencyVisitAction({ visitId: visit.id, lines });
      if (!result.ok) return notify.error(result.error);
      notify.success("Visita operativa confirmada."); setOpenId(null); setConfirmation({}); await reload();
    });
  }

  return <Panel title="Visitas de agencias" action={<Building2 className="h-5 w-5 text-emerald-300" />}>
    <p className="mb-3 text-xs font-bold text-slate-400">Solo movimientos físicos. Los cobros y saldos permanecen en contabilidad.</p>
    <div className="grid gap-2">{visits.length ? visits.map((visit) => <article key={visit.id} className="rounded-lg border border-black bg-surface-list-row p-3">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpenId((current) => current === visit.id ? null : visit.id)}><span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-200"><Building2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-black text-slate-100">{visit.agencyName}</span><span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-400"><MapPin className="h-3 w-3" />{visit.address}</span><span className="mt-1 block text-xs font-black text-emerald-300">{visit.routeName}</span></span></button>
      {openId === visit.id ? <div className="mt-3 grid gap-3 border-t border-black pt-3"><div className="grid gap-2">{visit.lines.map((line) => { const value=lineConfirmation(line); const needsReason=Number(value.quantity)!==line.requestedQuantity; return <div key={line.id} className="grid gap-2 rounded-md bg-surface-inset px-3 py-2 text-sm font-bold text-slate-200 sm:grid-cols-[1fr_5rem_1fr] sm:items-center"><span>{line.label} <span className="text-xs text-slate-500">pedido: {line.requestedQuantity}</span></span><input className="h-9 rounded-md border border-black bg-surface-card px-2 text-center font-black text-emerald-200" type="number" min="0" value={value.quantity} onChange={(event)=>updateLine(line.id,{quantity:event.target.value})}/>{needsReason?<input className="h-9 rounded-md border border-black bg-surface-card px-2 text-xs text-slate-100" value={value.reason} onChange={(event)=>updateLine(line.id,{reason:event.target.value})} placeholder="Motivo obligatorio"/>:<span className="text-xs text-emerald-300">Cantidad confirmada</span>}</div>; })}</div><div className="flex gap-2"><button type="button" className={primaryButtonClass} disabled={pending} onClick={()=>closeVisit(visit)}>{pending?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>} Confirmar visita</button><button type="button" className={secondaryButtonClass} onClick={()=>setOpenId(null)} disabled={pending}>Volver</button></div></div>:null}
    </article>) : <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">No tienes visitas de agencia en esta ruta.</p>}</div>
  </Panel>;
}
