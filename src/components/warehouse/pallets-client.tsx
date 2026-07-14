"use client";

import { useMemo, useState } from "react";
import { Layers3, Plus } from "lucide-react";
import { addPhysicalPackageToPalletAction, createWarehousePalletAction, type WarehousePallet } from "@/app/actions/physical-packages";
import { ViewLayoutToggle } from "@/components/view-layout-toggle";
import { inputClass, Panel, primaryButtonClass } from "@/components/ui-blocks";
import { useViewLayout } from "@/hooks/use-view-layout";
import { useNotify } from "@/hooks/use-notify";
import type { PhysicalPackage } from "@/lib/physical-packages";
import { formatWarehouseDateTime, formatWarehouseElapsed } from "@/lib/warehouse-timing";

export function PalletsClient({ initialPallets = [], initialPackages = [] }: { initialPallets?: WarehousePallet[]; initialPackages?: PhysicalPackage[] }) {
  const notify = useNotify();
  const { layout, toggleViewLayout } = useViewLayout();
  const [pallets, setPallets] = useState(initialPallets);
  const [packages, setPackages] = useState(initialPackages);
  const [code, setCode] = useState("");
  const [country, setCountry] = useState("");
  const [selectedPallet, setSelectedPallet] = useState("");
  const [busy, setBusy] = useState("");
  const activePallet = useMemo(() => pallets.find((pallet) => pallet.id === selectedPallet) || null, [pallets, selectedPallet]);

  async function create() {
    const result = await createWarehousePalletAction({ code, country });
    if (!result.ok) return notify.error(result.error);
    setPallets((rows) => [result.data, ...rows]); setSelectedPallet(result.data.id); setCode(""); setCountry(""); notify.success("Paleta creada.");
  }
  async function add(pkg: PhysicalPackage) {
    if (!selectedPallet) return notify.error("Selecciona una paleta.");
    setBusy(pkg.id);
    try {
      const result = await addPhysicalPackageToPalletAction({ packageId: pkg.id, palletId: selectedPallet });
      if (!result.ok) return notify.error(result.error);
      const palletizedAt = new Date().toISOString();
      setPackages((rows) => rows.filter((row) => row.id !== pkg.id));
      setPallets((rows) => rows.map((row) => row.id === selectedPallet ? { ...row, packageCount: row.packageCount + 1, packages: [{ id: pkg.id, code: pkg.code, intakeRecordedAt: pkg.intakeRecordedAt, palletizedAt }, ...row.packages] } : row));
      notify.success(`${pkg.code} agregada a paleta.`);
    } finally { setBusy(""); }
  }
  const packageGrid = layout === "cards" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-2";
  return <Panel title="Paletas" hideHeader contentClassName="p-0"><div className="grid min-h-full gap-5 p-4 pb-8 sm:p-5 sm:pb-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <aside className="border-b border-black pb-5 lg:border-b-0 lg:border-r lg:pr-5"><div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-emerald-300" /><h1 className="font-black text-slate-100">Paletas</h1></div><div className="mt-4 grid gap-2"><input className={inputClass} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ej. PAL-001" /><input className={inputClass} value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Pais de destino" /><button className={`${primaryButtonClass} h-10`} onClick={() => void create()}><Plus className="h-4 w-4" />Crear paleta</button></div><div className="mt-5 grid gap-2">{pallets.map((pallet) => <button key={pallet.id} type="button" onClick={() => setSelectedPallet(pallet.id)} className={`rounded-lg border px-3 py-2 text-left ${selectedPallet === pallet.id ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-black bg-surface-inset text-slate-100"}`}><p className="font-black">{pallet.code}</p><p className="text-xs font-bold opacity-70">{pallet.country} · {pallet.packageCount} cajas</p></button>)}</div></aside>
    <section className="space-y-5"><header className="flex items-center justify-between gap-3 border-b border-black pb-4"><div><h2 className="text-lg font-black text-slate-100">Cajas disponibles para paletizar</h2><p className="mt-1 text-sm font-bold text-slate-400">Selecciona una paleta y agrega sus cajas.</p></div><ViewLayoutToggle layout={layout} onToggle={toggleViewLayout} /></header><div className={packageGrid}>{packages.map((pkg) => <article key={pkg.id} className="rounded-lg border border-black bg-surface-card p-3"><p className="font-black text-slate-100">{pkg.code}</p><p className="mt-1 text-xs font-bold text-slate-400">{pkg.country} · {pkg.providerName || "Sin proveedor"}</p><p className="mt-2 text-xs font-bold text-slate-500">Ingreso: {formatWarehouseDateTime(pkg.intakeRecordedAt)}</p><button className={`${primaryButtonClass} mt-3 h-9 w-full text-sm`} disabled={busy === pkg.id} onClick={() => void add(pkg)}>Agregar a paleta</button></article>)}{!packages.length ? <p className="text-sm font-bold text-slate-500">No hay cajas disponibles en bodega.</p> : null}</div>{activePallet ? <section className="border-t border-black pt-4"><div className="flex items-center justify-between gap-3"><h2 className="font-black text-slate-100">{activePallet.code}</h2><span className="text-xs font-black text-emerald-300">{activePallet.packageCount} cajas</span></div><div className={layout === "cards" ? "mt-3 grid gap-2 sm:grid-cols-2" : "mt-3 grid gap-2"}>{activePallet.packages.map((pkg) => <article key={pkg.id} className="rounded-lg border border-black bg-surface-card p-3"><p className="font-black text-slate-100">{pkg.code}</p><p className="mt-1 text-xs font-bold text-slate-400">En paleta: {formatWarehouseDateTime(pkg.palletizedAt)}</p><p className="mt-1 text-xs font-black text-emerald-300">Ingreso a paleta: {formatWarehouseElapsed(pkg.intakeRecordedAt, pkg.palletizedAt)}</p></article>)}</div></section> : null}</section>
  </div></Panel>;
}
