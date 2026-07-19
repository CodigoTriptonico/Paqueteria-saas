"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, RefreshCw } from "lucide-react";
import {
  createAcquiredDistributionPartnerAction,
  loadAcquisitionPortfolioAction,
  type DistributionPartner,
} from "@/app/actions/distribution";
import { Panel, StatCard, inputClass, primaryButtonClass } from "@/components/ui-blocks";
import { uppercasePersonNameInput } from "@/lib/person-name";

type Props = { initialPartners?: DistributionPartner[] | null };
const fieldClass = `${inputClass} w-full`;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

export function AcquisitionWorkspace({ initialPartners = null }: Props) {
  const [partners, setPartners] = useState<DistributionPartner[] | null>(initialPartners);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const metrics = useMemo(() => {
    const sales = partners?.flatMap((partner) => partner.shipments) || [];
    const charges = partners?.flatMap((partner) => partner.ledger).filter((entry) => entry.kind === "charge").reduce((sum, entry) => sum + entry.amount, 0) || 0;
    return { active: partners?.filter((partner) => partner.isActive).length || 0, sales: sales.length, charges, pending: partners?.filter((partner) => !partner.isActive).length || 0 };
  }, [partners]);

  function reload() {
    startTransition(async () => {
      const result = await loadAcquisitionPortfolioAction();
      if (!result.ok) return setNotice(result.error);
      setPartners(result.data);
    });
  }

  if (!partners) {
    return <Panel title="Mis distribuidores"><div className="flex items-center gap-3"><p className="text-sm font-bold text-slate-300">No se pudo cargar tu cartera.</p><button onClick={reload} className={primaryButtonClass}><RefreshCw className="h-4 w-4" /> Reintentar</button></div></Panel>;
  }

  return <div className="space-y-4"><Panel title="Mis distribuidores" action={<button onClick={() => setShowCreate((value) => !value)} className={primaryButtonClass}><Building2 className="h-4 w-4" /> {showCreate ? "Cerrar" : "Captar distribuidor"}</button>}><p className="text-sm font-bold text-slate-300">Tu cartera muestra las ventas que pertenecen a tus distribuidores. La matriz configura tarifas, crédito y logística.</p>{showCreate ? <CreateAcquiredPartner isPending={isPending} onDone={() => { setShowCreate(false); setNotice("Distribuidor enviado a la matriz para configuración."); reload(); }} onError={setNotice} /> : null}</Panel><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Cartera activa" value={String(metrics.active)} tone="text-emerald-300" /><StatCard label="Pendientes de activar" value={String(metrics.pending)} tone="text-amber-300" /><StatCard label="Ventas distribuidoras" value={String(metrics.sales)} tone="text-slate-100" /><StatCard label="Venta interna" value={money(metrics.charges)} tone="text-emerald-300" /></section>{notice ? <p className="rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm font-bold text-slate-200">{notice}</p> : null}<Panel title="Mi cartera" hideHeader contentClassName="p-0"><div className="grid gap-2 p-3">{partners.map((partner) => <article key={partner.id} className="grid gap-3 rounded-lg border border-black bg-surface-inset p-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem]"><div><h2 className="font-black text-slate-100">{partner.name}</h2><p className="text-xs font-bold text-slate-400">{partner.ownerName || partner.ownerEmail || "Sin responsable"}</p></div><div><p className="text-[10px] font-black uppercase text-slate-500">Estado</p><p className={partner.isActive ? "font-black text-emerald-300" : "font-black text-amber-300"}>{partner.isActive ? "Activo" : "Pendiente"}</p></div><div><p className="text-[10px] font-black uppercase text-slate-500">Ventas</p><p className="font-black text-slate-100">{partner.shipments.length}</p></div></article>)}{!partners.length ? <p className="rounded-lg border border-dashed border-black p-5 text-sm font-bold text-slate-400">Aún no tienes distribuidores. Crea el primero para enviarlo a configuración de matriz.</p> : null}</div></Panel></div>;
}

function CreateAcquiredPartner({ isPending, onDone, onError }: { isPending: boolean; onDone: () => void; onError: (message: string) => void }) {
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, startTransition] = useTransition();
  function submit() {
    startTransition(async () => {
      const result = await createAcquiredDistributionPartnerAction({ name, fullName, email, password });
      if (!result.ok) return onError(result.error);
      onDone();
    });
  }
  return <div className="mt-4 grid gap-2 border-t border-black pt-4 md:grid-cols-2 xl:grid-cols-5"><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Empresa distribuidora" /><input className={fieldClass} value={fullName} onChange={(event) => setFullName(uppercasePersonNameInput(event.target.value))} placeholder="Responsable" /><input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo de acceso" /><input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña inicial" /><button disabled={isPending || saving} onClick={submit} className={primaryButtonClass}>Enviar a matriz</button></div>;
}
