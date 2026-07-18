"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ScanLine, Scale, Truck } from "lucide-react";
import {
  receivePhysicalPackageAtIntakeAction,
  returnPhysicalPackageToTruckAction,
  unloadTruckToWarehouseIntakeAction,
  type WarehouseTruckArrival,
} from "@/app/actions/physical-packages";
import { ViewLayoutToggle } from "@/components/view-layout-toggle";
import { inputClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useViewLayout } from "@/hooks/use-view-layout";
import { useNotify } from "@/hooks/use-notify";
import type { PhysicalPackage } from "@/lib/physical-packages";

function disclosureClass(active: boolean) {
  return `inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black transition ${active ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-black bg-surface-inset text-slate-100 hover:bg-surface-card"}`;
}

function PackageCard({ pkg, selected, layout, onClick }: { pkg: PhysicalPackage; selected?: boolean; layout: "cards" | "rows"; onClick?: () => void }) {
  const Tag = onClick ? "button" : "article";
  return <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`rounded-lg border p-3 text-left ${layout === "cards" ? "min-h-28" : ""} ${selected ? "border-emerald-400 bg-emerald-400/10" : "border-black bg-surface-card hover:bg-surface-card-hover"}`}>
    <p className="font-black text-slate-100">{pkg.code}</p>
    <p className="mt-1 font-mono text-xs font-black text-emerald-200">Factura {pkg.invoiceCode}</p>
    <p className="mt-1 text-xs font-bold text-slate-400">{pkg.customerName} · {pkg.country} · Recogida {pkg.collectionWeightKg?.toFixed(2) || "-"} kg</p>
    {pkg.truckUnloadedAt ? <p className="mt-2 text-xs font-bold text-sky-200">Descargada del camión</p> : null}
  </Tag>;
}

export function WarehouseIntakeClient({ initialPackages = [], initialReceived = [], initialTruckArrivals = [] }: {
  initialPackages?: PhysicalPackage[];
  initialReceived?: PhysicalPackage[];
  initialTruckArrivals?: WarehouseTruckArrival[];
}) {
  const notify = useNotify();
  const { layout, toggleViewLayout } = useViewLayout();
  const [packages, setPackages] = useState(initialPackages);
  const [receivedPackages, setReceivedPackages] = useState(initialReceived);
  const [trucks, setTrucks] = useState(initialTruckArrivals);
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [showTrucks, setShowTrucks] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [code, setCode] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [unloading, setUnloading] = useState(false);
  const [returning, setReturning] = useState(false);
  const selected = useMemo(() => packages.find((pkg) => pkg.code.toLowerCase() === code.trim().toLowerCase()) || null, [code, packages]);
  const selectedTruck = trucks.find((truck) => truck.routeId === selectedTruckId) || null;
  const enteredWeight = Number(weight.replace(",", "."));

  async function receive() {
    if (!selected || !enteredWeight) return;
    setSaving(true);
    try {
      const result = await receivePhysicalPackageAtIntakeAction({ code, weightKg: enteredWeight });
      if (!result.ok) return notify.error(result.error);
      setPackages((rows) => rows.filter((pkg) => pkg.id !== result.data.id));
      setReceivedPackages((rows) => [result.data, ...rows]);
      setCode(""); setWeight(""); setShowReceived(true);
      notify.success(`${result.data.code} ingresada.`);
    } finally { setSaving(false); }
  }

  async function unload() {
    if (!selectedTruck) return;
    setUnloading(true);
    try {
      const result = await unloadTruckToWarehouseIntakeAction(selectedTruck.routeId);
      if (!result.ok) return notify.error(result.error);
      setPackages((rows) => [...result.data, ...rows]);
      setTrucks((rows) => rows.filter((truck) => truck.routeId !== selectedTruck.routeId));
      setSelectedTruckId(""); setShowPending(true);
      notify.success(`${result.data.length} cajas descargadas a ingreso.`);
    } finally { setUnloading(false); }
  }

  async function returnToTruck() {
    if (!selected) return;
    setReturning(true);
    try {
      const result = await returnPhysicalPackageToTruckAction(selected.id);
      if (!result.ok) return notify.error(result.error);
      setPackages((rows) => rows.filter((pkg) => pkg.id !== selected.id));
      setCode(""); setWeight("");
      notify.success(`${selected.code} volvió al camión.`);
    } finally { setReturning(false); }
  }

  const gridClass = layout === "cards" ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-2";
  return <Panel title="Ingreso a bodega" hideHeader className="min-h-0" contentClassName="p-0">
    <div className="min-h-full space-y-4 p-4 pb-8 sm:p-5 sm:pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
        <div><h1 className="text-xl font-black text-slate-100">Ingreso a bodega</h1><p className="mt-1 text-sm font-bold text-slate-400">Confirma el peso de cada caja al llegar.</p></div>
        <div className="flex flex-wrap items-center gap-2"><ViewLayoutToggle layout={layout} onToggle={toggleViewLayout} /><button type="button" className={disclosureClass(showPending)} onClick={() => setShowPending((value) => !value)}>{showPending ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}Pendientes <span>{packages.length}</span></button><button type="button" className={disclosureClass(showReceived)} onClick={() => setShowReceived((value) => !value)}>{showReceived ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}Ingresadas <span>{receivedPackages.length}</span></button><button type="button" className={disclosureClass(showTrucks)} onClick={() => setShowTrucks((value) => !value)}><Truck className="h-4 w-4" />Camiones <span>{trucks.length}</span></button></div>
      </header>

      <section className="border-b border-black pb-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-400 text-slate-950"><ScanLine className="h-5 w-5" /></span><div><h2 className="font-black text-slate-100">Registrar llegada</h2><p className="text-sm font-bold text-slate-400">Escanea una caja o tócala en la cola.</p></div></div><div className="mt-3 grid grid-cols-[minmax(0,1fr)_6rem] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_auto]"><label className="grid min-w-0 gap-1 text-xs font-black uppercase text-slate-500">Código de caja<input autoFocus className={`${inputClass} w-full`} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej. INV-0001-01" /></label><label className="grid w-24 gap-1 text-xs font-black uppercase text-slate-500">Peso (kg)<input className={`${inputClass} w-full`} inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0.00" /></label><button type="button" className={`${primaryButtonClass} col-span-2 h-11 sm:col-span-1`} disabled={!selected || !enteredWeight || saving} onClick={() => void receive()}>{saving ? "Guardando..." : "Confirmar"}</button></div>{selected ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black bg-surface-card p-3"><p className="text-sm font-black text-slate-100">{selected.code} <span className="text-slate-400">· {selected.customerName}</span></p>{selected.truckRouteId ? <button type="button" className={`${secondaryButtonClass} h-8 text-xs`} disabled={returning} onClick={() => void returnToTruck()}>{returning ? "Devolviendo..." : "Devolver al camión"}</button> : null}</div> : code ? <p className="mt-2 text-sm font-bold text-amber-300">El código no está en la cola de ingreso.</p> : null}</section>

      {showTrucks ? <section className="border-b border-black pb-4"><div className="mb-3 flex items-center gap-2"><Truck className="h-5 w-5 text-sky-300" /><h2 className="font-black text-slate-100">Camiones listos para descargar</h2></div><div className={gridClass}>{trucks.map((truck) => <button key={truck.routeId} type="button" onClick={() => setSelectedTruckId(truck.routeId)} className={`rounded-lg border p-3 text-left ${selectedTruckId === truck.routeId ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-black bg-surface-card text-slate-100"}`}><p className="font-black">{truck.vehicleName}</p><p className="mt-1 text-xs font-bold opacity-75">{truck.routeName} · {truck.driverName}</p><p className="mt-2 text-xs font-black">{truck.packageCount} cajas</p></button>)}</div>{selectedTruck ? <button type="button" onClick={() => void unload()} disabled={unloading} className={`${primaryButtonClass} mt-3 h-10`}>{unloading ? "Descargando..." : `Descargar ${selectedTruck.packageCount} cajas a ingreso`}</button> : null}{!trucks.length ? <p className="text-sm font-bold text-slate-500">No hay camiones pendientes.</p> : null}</section> : null}
      {showPending ? <section><div className="mb-3 flex items-center gap-2"><Scale className="h-5 w-5 text-amber-300" /><h2 className="font-black text-slate-100">Pendientes de ingreso</h2></div><div className={gridClass}>{packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} layout={layout} selected={selected?.id === pkg.id} onClick={() => { setCode(pkg.code); setWeight(""); }} />)}{!packages.length ? <p className="text-sm font-bold text-slate-500">No hay cajas pendientes.</p> : null}</div></section> : null}
      {showReceived ? <section><div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-300" /><h2 className="font-black text-slate-100">Ingresadas en recepción</h2></div><div className={gridClass}>{receivedPackages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} layout={layout} />)}{!receivedPackages.length ? <p className="text-sm font-bold text-slate-500">Aún no ingresas cajas.</p> : null}</div></section> : null}
    </div>
  </Panel>;
}
