"use client";

import { AlertTriangle, CheckCheck, ClipboardCheck, PackageCheck, Send, UserRoundCheck } from "lucide-react";
import { useState, useTransition } from "react";
import {
  acceptPackageCustodyHandoffAction,
  approveOperationalExceptionAction,
  initiatePackageCustodyHandoffAction,
  reportOperationalExceptionAction,
  resolveOperationalExceptionAction,
  type ControlledException,
  type ControlledHandoff,
  type ControlledPackageCustody,
} from "@/app/actions/controlled-operations";
import { CompactInfoDisclosure, inputClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { custodyHolderLabel, exceptionTypeLabel, type CustodyHolderType, type OperationalExceptionType } from "@/lib/controlled-operations";
import { custodyCurrentLabel, packageCustodyEventLabel } from "@/lib/package-custody";

const exceptionTypes = Object.keys(exceptionTypeLabel) as OperationalExceptionType[];
const holderTypes = Object.keys(custodyHolderLabel) as CustodyHolderType[];

export function ControlledOperationsClient({
  initialHandoffs,
  initialExceptions,
  initialCustody,
  packageId = "",
}: {
  initialHandoffs: ControlledHandoff[];
  initialExceptions: ControlledException[];
  initialCustody: ControlledPackageCustody[];
  packageId?: string;
}) {
  const notify = useNotify();
  const [handoffs, setHandoffs] = useState(initialHandoffs);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [custody] = useState(initialCustody);
  const [pending, startTransition] = useTransition();
  const [handoff, setHandoff] = useState({ packageId, holderType: "bodega" as CustodyHolderType, holderLabel: "", reason: "" });
  const [exception, setException] = useState({ packageId, type: "not_delivered" as OperationalExceptionType, reason: "" });

  function startHandoff() {
    startTransition(async () => {
      const result = await initiatePackageCustodyHandoffAction(handoff);
      if (!result.ok) return notify.error(result.error);
      setHandoffs((rows) => [{ id: result.data.handoffId, packageCode: "Caja seleccionada", fromLabel: "Custodia actual", toLabel: handoff.holderLabel || custodyHolderLabel[handoff.holderType], status: "pending", initiatedAt: new Date().toISOString(), receivedAt: null }, ...rows]);
      setHandoff((current) => ({ ...current, holderLabel: "", reason: "" }));
      notify.success("Traspaso enviado. Falta la recepción del destino.");
    });
  }

  function accept(handoffId: string) {
    const evidence = window.prompt("Escribe la evidencia de recepción (nota, foto o firma):");
    if (!evidence?.trim()) return;
    startTransition(async () => {
      const result = await acceptPackageCustodyHandoffAction(handoffId, evidence);
      if (!result.ok) return notify.error(result.error);
      setHandoffs((rows) => rows.map((row) => row.id === handoffId ? { ...row, status: "accepted", receivedAt: new Date().toISOString() } : row));
      notify.success("Recepción confirmada. La custodia quedó actualizada.");
    });
  }

  function reportException() {
    startTransition(async () => {
      const result = await reportOperationalExceptionAction(exception);
      if (!result.ok) return notify.error(result.error);
      setExceptions((rows) => [{ id: result.data.exceptionId, packageCode: "Caja seleccionada", type: exception.type, status: "open", reason: exception.reason, reportedAt: new Date().toISOString(), blocksRelease: ["damaged", "lost", "weight_difference"].includes(exception.type) }, ...rows]);
      setException((current) => ({ ...current, reason: "" }));
      notify.success("Excepción registrada y asignada a operación.");
    });
  }

  function resolve(exceptionId: string) {
    const note = window.prompt("Indica la resolución operativa:");
    if (!note?.trim()) return;
    startTransition(async () => {
      const result = await resolveOperationalExceptionAction(exceptionId, note);
      if (!result.ok) return notify.error(result.error);
      setExceptions((rows) => rows.map((row) => row.id === exceptionId ? { ...row, status: ["damaged", "lost", "weight_difference", "cancel_pre_departure"].includes(row.type) ? "pending_approval" : "resolved" } : row));
      notify.success("Resolución registrada.");
    });
  }

  function approve(exceptionId: string) {
    startTransition(async () => {
      const result = await approveOperationalExceptionAction(exceptionId);
      if (!result.ok) return notify.error(result.error);
      setExceptions((rows) => rows.map((row) => row.id === exceptionId ? { ...row, status: "resolved" } : row));
      notify.success("Excepción aprobada y cerrada.");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-5">
      <Panel
        title={packageId ? "Quién tiene esta caja" : "Quién tiene cada caja ahora"}
        action={
          <>
            <UserRoundCheck className="h-5 w-5 text-emerald-300" />
            <CompactInfoDisclosure ariaLabel="Cómo funciona la custodia">
              Cada cambio físico deja quién la tenía, quién la recibió, cuándo y por qué. La última línea es la custodia actual.
            </CompactInfoDisclosure>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {custody.map((row) => <article key={row.packageId} className="rounded-lg border border-black bg-surface-list-row p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-100">{row.packageCode}</p><p className="mt-1 text-sm font-black text-emerald-200">La tiene: {custodyCurrentLabel(row.holderLabel)}</p></div><span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-slate-300">{row.history.length} pasos</span></div><p className="mt-2 text-xs font-bold text-slate-500">Desde {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.since))}</p><details className="mt-3 border-t border-black pt-3"><summary className="cursor-pointer text-xs font-black text-slate-300">Ver cómo llegó</summary><ol className="mt-3 grid gap-2">{row.history.map((event) => <li key={event.id} className="text-xs font-bold text-slate-400"><span className="text-slate-100">{packageCustodyEventLabel[event.type]}</span>{event.fromLabel ? ` · ${event.fromLabel} → ` : " · "}{event.toLabel || "Destino sin registrar"}<br /><span className="text-slate-500">{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))} · {event.actorName}</span></li>)}</ol>{!row.history.length ? <p className="mt-3 text-xs font-bold text-slate-500">Abre esta caja para cargar su historial completo.</p> : null}</details></article>)}
          {!custody.length ? <p className="text-sm font-bold text-slate-500">No hay cajas con custodia registrada todavía.</p> : null}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Entregar una caja" action={<Send className="h-5 w-5 text-emerald-300" />}>
          <div className="grid gap-3 sm:grid-cols-2"><input className={inputClass} value={handoff.packageId} onChange={(event) => setHandoff((current) => ({ ...current, packageId: event.target.value }))} placeholder="ID de caja" /><select className={inputClass} value={handoff.holderType} onChange={(event) => setHandoff((current) => ({ ...current, holderType: event.target.value as CustodyHolderType }))}>{holderTypes.map((type) => <option key={type} value={type}>{custodyHolderLabel[type]}</option>)}</select><input className={inputClass} value={handoff.holderLabel} onChange={(event) => setHandoff((current) => ({ ...current, holderLabel: event.target.value }))} placeholder="Nombre o código del destino" /><input className={inputClass} value={handoff.reason} onChange={(event) => setHandoff((current) => ({ ...current, reason: event.target.value }))} placeholder="Evidencia de entrega: nota, foto o firma" /></div>
          <button type="button" className={`${primaryButtonClass} mt-3 h-10`} disabled={pending || !handoff.packageId || !handoff.holderLabel.trim() || !handoff.reason.trim()} onClick={startHandoff}><PackageCheck className="h-4 w-4" />Entregar para recepción</button>
        </Panel>
        <Panel title="Reportar excepción" action={<AlertTriangle className="h-5 w-5 text-amber-300" />}>
          <div className="grid gap-3 sm:grid-cols-2"><input className={inputClass} value={exception.packageId} onChange={(event) => setException((current) => ({ ...current, packageId: event.target.value }))} placeholder="ID de caja" /><select className={inputClass} value={exception.type} onChange={(event) => setException((current) => ({ ...current, type: event.target.value as OperationalExceptionType }))}>{exceptionTypes.map((type) => <option key={type} value={type}>{exceptionTypeLabel[type]}</option>)}</select><textarea className={`${inputClass} min-h-20 sm:col-span-2`} value={exception.reason} onChange={(event) => setException((current) => ({ ...current, reason: event.target.value }))} placeholder="Qué pasó y qué se hizo en el momento" /></div>
          <button type="button" className={`${secondaryButtonClass} mt-3 h-10`} disabled={pending || !exception.packageId || !exception.reason.trim()} onClick={reportException}><AlertTriangle className="h-4 w-4" />Registrar excepción</button>
        </Panel>
      </div>

      <Panel title="Recepciones pendientes" action={<ClipboardCheck className="h-5 w-5 text-amber-300" />}>
        <div className="grid gap-2">{handoffs.map((row) => <article key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-black bg-surface-list-row p-3"><div className="min-w-0 flex-1"><p className="font-black text-slate-100">{row.packageCode}</p><p className="text-xs font-bold text-slate-400">{row.fromLabel || "Origen"} → {row.toLabel || "Destino"}</p></div><span className={`rounded-md border px-2 py-1 text-xs font-black ${row.status === "accepted" ? "border-emerald-800 bg-emerald-950/40 text-emerald-200" : "border-amber-800 bg-amber-950/35 text-amber-200"}`}>{row.status === "accepted" ? "Recibida" : "Pendiente de recibir"}</span>{row.status === "pending" ? <button type="button" className={`${primaryButtonClass} h-9 text-xs`} disabled={pending} onClick={() => accept(row.id)}><CheckCheck className="h-4 w-4" />Recibir</button> : null}</article>)}{!handoffs.length ? <p className="text-sm font-bold text-slate-500">No hay traspasos registrados todavía.</p> : null}</div>
      </Panel>

      <Panel title="Excepciones abiertas" action={<AlertTriangle className="h-5 w-5 text-amber-300" />}>
        <div className="grid gap-2">{exceptions.map((row) => <article key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-black bg-surface-list-row p-3"><div className="min-w-0 flex-1"><p className="font-black text-slate-100">{row.packageCode} · {exceptionTypeLabel[row.type]}</p><p className="mt-1 text-sm font-bold text-slate-400">{row.reason}</p></div><span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-black text-slate-300">{row.status === "pending_approval" ? "Pendiente de aprobación" : row.status === "resolved" ? "Resuelta" : "Abierta"}</span>{row.status === "open" ? <button type="button" className={`${secondaryButtonClass} h-9 text-xs`} disabled={pending} onClick={() => resolve(row.id)}>Resolver</button> : null}{row.status === "pending_approval" ? <button type="button" className={`${primaryButtonClass} h-9 text-xs`} disabled={pending} onClick={() => approve(row.id)}>Aprobar</button> : null}</article>)}{!exceptions.length ? <p className="text-sm font-bold text-slate-500">No hay excepciones abiertas.</p> : null}</div>
      </Panel>
    </div>
  );
}
