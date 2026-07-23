"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Download, KeyRound, PackagePlus, PauseCircle, PlayCircle, RefreshCw, Search, WalletCards } from "lucide-react";
import {
  createDistributionPartnerAction,
  createDistributionSaleAction,
  assignDistributionPartnerCaptorAction,
  exportDistributionLedgerAction,
  loadDistributionWorkspaceAction,
  recordDistributionPaymentAction,
  resetDistributionPartnerPasswordAction,
  saveDistributionOfferAction,
  setDistributionPartnerStatusAction,
  setDistributionPublicPriceAction,
  updateDistributionCreditLimitAction,
  updateDistributionPartnerAction,
  type DistributionCatalogItem,
  type DistributionCaptor,
  type DistributionPartner,
  type DistributionWorkspace,
} from "@/app/actions/distribution";
import {
  distributionDashboardMetrics,
  isDistributionPartnerCreditBlocked,
  type DistributionDashboardPeriod,
} from "@/lib/distribution/dashboard";
import { CompactInfoDisclosure, Panel, StatCard, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { formatPersonNameInput } from "@/lib/person-name";

type Props = { initialWorkspace?: DistributionWorkspace | null };
type PartnerStatus = "all" | "active" | "paused" | "blocked";
type MatrixTab = "summary" | "products" | "account" | "operation" | "access";

const fieldClass = `${inputClass} w-full`;

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function selectedCatalogValue(item: DistributionCatalogItem) {
  return `${item.countryName}\u0000${item.catalogKey}\u0000${item.productName}`;
}

function parseCatalogValue(value: string) {
  const [countryName = "", catalogKey = "", productName = ""] = value.split("\u0000");
  return { countryName, catalogKey, productName };
}

export function DistributionWorkspace({ initialWorkspace = null }: Props) {
  const [workspace, setWorkspace] = useState<DistributionWorkspace | null>(initialWorkspace);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialWorkspace?.partners[0]?.id || "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPartner = useMemo(
    () => workspace?.partners.find((partner) => partner.id === selectedPartnerId) || workspace?.partners[0] || null,
    [selectedPartnerId, workspace],
  );

  async function reload() {
    const result = await loadDistributionWorkspaceAction();
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setWorkspace(result.data);
    setSelectedPartnerId((current) => result.data.partners.some((partner) => partner.id === current) ? current : result.data.partners[0]?.id || "");
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setMessage(result.error || "No se pudo guardar.");
        return;
      }
      setMessage(success);
      await reload();
    });
  }

  function exportLedger(partnerId: string) {
    startTransition(async () => {
      const result = await exportDistributionLedgerAction({ partnerId });
      if (!result.ok) {
        setMessage(result.error || "No se pudo exportar.");
        return;
      }
      const url = URL.createObjectURL(new Blob(["\ufeff", result.data.csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Cuenta corriente exportada.");
    });
  }

  if (!workspace) {
    return <Panel title="Distribuidores"><div className="flex flex-wrap items-center gap-3"><p className="text-slate-300">No se pudo cargar la información de distribuidores.</p><button onClick={() => startTransition(reload)} className={primaryButtonClass}><RefreshCw className="h-4 w-4" /> Reintentar</button></div></Panel>;
  }

  return workspace.mode === "matrix" ? (
    <MatrixWorkspace
      partners={workspace.partners}
      catalog={workspace.catalog}
      captors={workspace.captors}
      selectedPartner={selectedPartner}
      selectedPartnerId={selectedPartnerId}
      isPending={isPending}
      message={message}
      onPartnerChange={setSelectedPartnerId}
      onRun={run}
      onExport={exportLedger}
    />
  ) : <DistributorWorkspace partner={selectedPartner} isPending={isPending} message={message} onRun={run} />;
}

function Notice({ message }: { message: string | null }) {
  return message ? <p className="rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm font-bold text-slate-200">{message}</p> : null;
}

function MatrixWorkspace({ partners, catalog, captors, selectedPartner, selectedPartnerId, isPending, message, onPartnerChange, onRun, onExport }: {
  partners: DistributionPartner[];
  catalog: DistributionCatalogItem[];
  captors: DistributionCaptor[];
  selectedPartner: DistributionPartner | null;
  selectedPartnerId: string;
  isPending: boolean;
  message: string | null;
  onPartnerChange: (partnerId: string) => void;
  onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void;
  onExport: (partnerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PartnerStatus>("all");
  const [period, setPeriod] = useState<DistributionDashboardPeriod>("30d");
  const [creating, setCreating] = useState(false);
  const metrics = useMemo(() => distributionDashboardMetrics(partners.map((partner) => ({
    id: partner.id,
    creditLimit: partner.creditLimit,
    balance: partner.balance,
    isActive: partner.isActive,
    ledger: partner.ledger,
    shipmentsCreatedAt: partner.shipments.map((shipment) => shipment.createdAt),
  })), period), [partners, period]);
  const visiblePartners = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return partners.filter((partner) => {
      const blocked = isDistributionPartnerCreditBlocked(partner);
      const matchesStatus = status === "all" || (status === "active" && partner.isActive) || (status === "paused" && !partner.isActive) || (status === "blocked" && blocked);
      return matchesStatus && (!needle || [partner.name, partner.ownerName, partner.ownerEmail, partner.acquisitionOwnerName].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
    });
  }, [partners, query, status]);

  return <div className="space-y-4">
    <Panel title="Distribuidores" action={<button onClick={() => setCreating((value) => !value)} className={primaryButtonClass}><Building2 className="h-4 w-4" /> {creating ? "Cerrar" : "Crear distribuidor"}</button>}>
      <p className="text-sm font-bold text-slate-300">La matriz controla productos, tarifa interna, crédito y logística. El precio público se monitorea, pero no entra en tu cuenta por cobrar.</p>
      {creating ? <CreatePartner onRun={onRun} onDone={() => setCreating(false)} isPending={isPending} /> : null}
    </Panel>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Distribuidores activos" value={String(metrics.activePartners)} tone="text-emerald-300" />
      <StatCard label="Total por cobrar" value={money(metrics.totalDebt)} tone="text-amber-300" />
      <StatCard label="Cobrado en período" value={money(metrics.paymentsInPeriod)} tone="text-emerald-300" />
      <StatCard label="Ventas internas" value={money(metrics.internalSalesInPeriod)} tone="text-slate-100" />
      <StatCard label="Crédito comprometido" value={money(metrics.creditCommitted)} tone="text-slate-100" />
      <StatCard label="Crédito disponible" value={money(metrics.creditAvailable)} tone="text-emerald-300" />
      <StatCard label="Al límite" value={String(metrics.blockedPartners)} tone={metrics.blockedPartners ? "text-amber-300" : "text-slate-100"} />
      <StatCard label="Envíos en período" value={String(metrics.activeShipmentsInPeriod)} tone="text-slate-100" />
    </section>

    <Panel title="Control de distribuidores" contentClassName="p-4 sm:p-5">
      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-500" /><input className={`${fieldClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa, responsable o correo" /></label>
        <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as PartnerStatus)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="blocked">Al límite</option><option value="paused">Pausados</option></select>
        <select className={fieldClass} value={period} onChange={(event) => setPeriod(event.target.value as DistributionDashboardPeriod)}><option value="today">Hoy</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="all">Todo el historial</option></select>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(17rem,.72fr)_minmax(0,1.65fr)]">
        <PartnerList partners={visiblePartners} selectedPartnerId={selectedPartnerId} onChange={onPartnerChange} />
        {selectedPartner ? <MatrixPartnerDetail key={selectedPartner.id} partner={selectedPartner} catalog={catalog} captors={captors} isPending={isPending} onRun={onRun} onExport={onExport} /> : <EmptyPartnerDetail />}
      </div>
    </Panel>
    <Notice message={message} />
  </div>;
}

function CreatePartner({ onRun, onDone, isPending }: { onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void; onDone: () => void; isPending: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  return <div className="mt-4 grid gap-2 border-t border-black pt-4 md:grid-cols-2 xl:grid-cols-5">
    <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Empresa distribuidora" />
    <input className={fieldClass} value={fullName} onChange={(event) => setFullName(formatPersonNameInput(event.target.value))} placeholder="Responsable" />
    <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo de acceso" />
    <input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña inicial" />
    <div className="flex gap-2"><input className={fieldClass} inputMode="decimal" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} placeholder="Límite de crédito" /><button disabled={isPending} onClick={() => { onRun(() => createDistributionPartnerAction({ name, email, fullName, password, creditLimit: Number(creditLimit) }), "Distribuidor creado. Configura sus productos y tarifa interna."); onDone(); }} className={primaryButtonClass}>Guardar</button></div>
  </div>;
}

function PartnerList({ partners, selectedPartnerId, onChange }: { partners: DistributionPartner[]; selectedPartnerId: string; onChange: (id: string) => void }) {
  return <div className="grid max-h-[46rem] gap-2 overflow-y-auto pr-1">
    {partners.map((partner) => {
      const blocked = isDistributionPartnerCreditBlocked(partner);
      const selected = partner.id === selectedPartnerId;
      return <button key={partner.id} onClick={() => onChange(partner.id)} className={`rounded-lg border p-3 text-left transition-colors ${selected ? "border-emerald-500 bg-emerald-400/10" : "border-black bg-surface-inset hover:bg-surface-card"}`}>
        <span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-base font-black text-slate-100">{partner.name}</span><span className="block truncate text-xs font-bold text-slate-400">{partner.ownerName || partner.ownerEmail || "Sin responsable"}</span></span><StatusBadge partner={partner} /></span>
        <span className="mt-3 grid grid-cols-2 gap-2 text-xs font-black"><span className="text-slate-400">DEBE <b className="ml-1 text-amber-300">{money(partner.balance)}</b></span><span className={blocked ? "text-amber-300" : "text-slate-400"}>DISP. <b className="ml-1 text-slate-100">{money(partner.availableCredit)}</b></span></span>
      </button>;
    })}
    {!partners.length ? <p className="rounded-lg border border-dashed border-black p-4 text-sm font-bold text-slate-400">No hay distribuidores con esos filtros.</p> : null}
  </div>;
}

function StatusBadge({ partner }: { partner: DistributionPartner }) {
  const blocked = isDistributionPartnerCreditBlocked(partner);
  const label = !partner.isActive ? "Pausado" : blocked ? "Al límite" : "Activo";
  const tone = !partner.isActive ? "bg-slate-700 text-slate-200" : blocked ? "bg-amber-300 text-slate-950" : "bg-emerald-400 text-slate-950";
  return <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-black uppercase ${tone}`}>{label}</span>;
}

function EmptyPartnerDetail() {
  return <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset p-6 text-center text-sm font-bold text-slate-400">Crea un distribuidor para configurar tarifas, crédito, cuenta corriente y acceso.</div>;
}

function MatrixPartnerDetail({ partner, catalog, captors, isPending, onRun, onExport }: { partner: DistributionPartner; catalog: DistributionCatalogItem[]; captors: DistributionCaptor[]; isPending: boolean; onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void; onExport: (partnerId: string) => void }) {
  const [tab, setTab] = useState<MatrixTab>("summary");
  const tabs: { id: MatrixTab; label: string }[] = [{ id: "summary", label: "Resumen" }, { id: "products", label: "Productos" }, { id: "account", label: "Cuenta" }, { id: "operation", label: "Operación" }, { id: "access", label: "Acceso" }];
  return <div className="min-w-0 space-y-3">
    <div className="border-b border-black/70 pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-xl font-black text-slate-100">{partner.name}</h2><StatusBadge partner={partner} /></div><p className="mt-1 break-words text-sm font-bold text-slate-400">{partner.ownerName || "Sin nombre"} · {partner.ownerEmail || "Sin correo"}</p></div><p className="text-xs font-bold text-slate-400">Alta {formatDate(partner.createdAt)}</p></div><div className="mt-4 flex gap-1 overflow-x-auto border-b border-black">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-black ${tab === item.id ? "border-emerald-400 text-emerald-300" : "border-transparent text-slate-400 hover:text-slate-100"}`}>{item.label}</button>)}</div></div>
    {tab === "summary" ? <PartnerSummary partner={partner} /> : null}
    {tab === "products" ? <ProductsTab partner={partner} catalog={catalog} isPending={isPending} onRun={onRun} /> : null}
    {tab === "account" ? <AccountTab partner={partner} isPending={isPending} onRun={onRun} onExport={onExport} /> : null}
    {tab === "operation" ? <OperationTab partner={partner} /> : null}
    {tab === "access" ? <CaptorAccessTab partner={partner} captors={captors} isPending={isPending} onRun={onRun} /> : null}
  </div>;
}

function PartnerSummary({ partner }: { partner: DistributionPartner }) {
  const charges = partner.ledger.filter((entry) => entry.kind === "charge").reduce((sum, entry) => sum + entry.amount, 0);
  const payments = partner.ledger.filter((entry) => entry.kind === "payment").reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Debe a matriz" value={money(partner.balance)} tone="text-amber-300" /><StatCard label="Crédito disponible" value={money(partner.availableCredit)} tone="text-emerald-300" /><StatCard label="Ventas internas" value={money(charges)} tone="text-slate-100" /><StatCard label="Pagado a matriz" value={money(payments)} tone="text-emerald-300" /><div className="flex items-center gap-2 sm:col-span-2 xl:col-span-4"><span className="text-xs font-black uppercase text-slate-500">Cómo se calcula</span><CompactInfoDisclosure ariaLabel="Cómo se calcula la cuenta del distribuidor">Cada venta del distribuidor genera un cargo por la <b className="text-slate-100">tarifa interna</b>. El precio público es de él y no cambia este saldo.</CompactInfoDisclosure></div></div>;
}

function ProductsTab({ partner, catalog, isPending, onRun }: { partner: DistributionPartner; catalog: DistributionCatalogItem[]; isPending: boolean; onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void }) {
  const [catalogValue, setCatalogValue] = useState(catalog[0] ? selectedCatalogValue(catalog[0]) : "");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const selected = parseCatalogValue(catalogValue);
  return <section className="space-y-3">
    <div className="flex justify-end"><CompactInfoDisclosure ariaLabel="Información de la tarifa interna">El distribuidor decide el precio público. Tú solo defines cuánto te paga por cada venta.</CompactInfoDisclosure></div>
    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]"><select className={fieldClass} value={catalogValue} onChange={(event) => setCatalogValue(event.target.value)}><option value="">Selecciona producto</option>{catalog.map((item) => <option key={selectedCatalogValue(item)} value={selectedCatalogValue(item)}>{item.countryName} · {item.productName}</option>)}</select><input className={fieldClass} inputMode="decimal" value={wholesalePrice} onChange={(event) => setWholesalePrice(event.target.value)} placeholder="Tarifa interna" /><button disabled={isPending || !catalogValue} onClick={() => onRun(() => saveDistributionOfferAction({ partnerId: partner.id, ...selected, wholesalePrice: Number(wholesalePrice), isActive: true }), "Producto y tarifa interna guardados.")} className={primaryButtonClass}>Agregar</button></div>
    <div className="grid gap-2">{partner.offers.map((offer) => <div key={offer.id} className="grid gap-2 rounded-lg border border-black bg-surface-inset p-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] md:items-center"><span className="min-w-0"><b className="block truncate text-slate-100">{offer.productName}</b><small className="text-slate-400">{offer.countryName} · público monitoreado: {offer.publicPrice === null ? "sin definir" : money(offer.publicPrice)}</small></span><input className={fieldClass} inputMode="decimal" value={prices[offer.id] ?? String(offer.wholesalePrice)} onChange={(event) => setPrices((current) => ({ ...current, [offer.id]: event.target.value }))} aria-label={`Tarifa interna ${offer.productName}`} /><span className={`text-sm font-black ${offer.isActive ? "text-emerald-300" : "text-slate-500"}`}>{offer.isActive ? "Activo" : "Inactivo"}</span><div className="flex gap-2"><button disabled={isPending} onClick={() => onRun(() => saveDistributionOfferAction({ partnerId: partner.id, countryName: offer.countryName, catalogKey: offer.catalogKey, productName: offer.productName, wholesalePrice: Number(prices[offer.id] ?? offer.wholesalePrice), isActive: offer.isActive }), "Tarifa interna actualizada.")} className={secondaryButtonClass}>Guardar</button><button disabled={isPending} onClick={() => onRun(() => saveDistributionOfferAction({ partnerId: partner.id, countryName: offer.countryName, catalogKey: offer.catalogKey, productName: offer.productName, wholesalePrice: offer.wholesalePrice, isActive: !offer.isActive }), offer.isActive ? "Producto pausado." : "Producto activado.")} className={secondaryButtonClass}>{offer.isActive ? "Pausar" : "Activar"}</button></div></div>)}{!partner.offers.length ? <p className="rounded-lg border border-dashed border-black p-4 text-sm font-bold text-slate-400">No tiene productos autorizados.</p> : null}</div>
  </section>;
}

function AccountTab({ partner, isPending, onRun, onExport }: { partner: DistributionPartner; isPending: boolean; onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void; onExport: (partnerId: string) => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/70 pb-3"><span className="font-black text-slate-100">Saldo por cobrar: <b className="text-amber-300">{money(partner.balance)}</b></span><button disabled={isPending} onClick={() => onExport(partner.id)} className={secondaryButtonClass}><Download className="h-4 w-4" /> Exportar CSV</button></div><div className="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)_auto]"><input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Monto" /><input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota o referencia de pago" /><button disabled={isPending || !amount} onClick={() => onRun(() => recordDistributionPaymentAction({ partnerId: partner.id, amount: Number(amount), note }), "Pago registrado en la cuenta corriente.")} className={primaryButtonClass}><WalletCards className="h-4 w-4" /> Registrar pago</button></div><Ledger entries={partner.ledger} /></section>;
}

function OperationTab({ partner }: { partner: DistributionPartner }) {
  return <section className="space-y-3"><p className="border-l-2 border-amber-400/70 pl-3 text-sm font-bold text-slate-300">Estos envíos entran a la operación central. El precio público se ve para monitoreo, pero el cliente final le debe al distribuidor.</p><DistributionShipments partner={partner} showPublicPrice /></section>;
}

function CaptorAccessTab({ partner, captors, isPending, onRun }: { partner: DistributionPartner; captors: DistributionCaptor[]; isPending: boolean; onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void }) {
  const [captorId, setCaptorId] = useState(partner.acquisitionOwnerId || "");
  return <div className="space-y-4"><section className="space-y-2 border-b border-black/70 pb-4"><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"><select className={fieldClass} value={captorId} onChange={(event) => setCaptorId(event.target.value)}><option value="">Sin asignar</option>{captors.map((captor) => <option key={captor.id} value={captor.id}>{captor.name}</option>)}</select><button disabled={isPending || !captorId || captorId === partner.acquisitionOwnerId} onClick={() => onRun(() => assignDistributionPartnerCaptorAction({ partnerId: partner.id, captorId, reason: "Reasignacion desde matriz" }), "Captador reasignado. Las ventas anteriores conservan su historial.")} className={secondaryButtonClass}>Guardar captador</button></div><p className="text-xs font-bold text-slate-400">La reasignacion solo afecta ventas futuras. El historial conserva al captador que tenia cada venta.</p></section><AccessTab partner={partner} isPending={isPending} onRun={onRun} /></div>;
}

function AccessTab({ partner, isPending, onRun }: { partner: DistributionPartner; isPending: boolean; onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void }) {
  const [name, setName] = useState(partner.name);
  const [ownerName, setOwnerName] = useState(partner.ownerName || "");
  const [ownerEmail, setOwnerEmail] = useState(partner.ownerEmail || "");
  const [creditLimit, setCreditLimit] = useState(String(partner.creditLimit));
  const [password, setPassword] = useState("");
  return <section className="space-y-4"><div className="grid gap-2 md:grid-cols-2"><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Empresa" /><input className={fieldClass} value={ownerName} onChange={(event) => setOwnerName(formatPersonNameInput(event.target.value))} placeholder="Responsable" /><input className={fieldClass} type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="Correo de acceso" /><button disabled={isPending} onClick={() => onRun(() => updateDistributionPartnerAction({ partnerId: partner.id, name, ownerName, ownerEmail }), "Datos del distribuidor actualizados.")} className={secondaryButtonClass}>Guardar datos</button></div><div className="grid gap-2 border-t border-black/70 pt-3 md:grid-cols-[minmax(0,1fr)_auto]"><label><span className="mb-1 block text-xs font-black uppercase text-slate-400">Límite de crédito</span><input className={fieldClass} inputMode="decimal" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} /></label><button disabled={isPending} onClick={() => onRun(() => updateDistributionCreditLimitAction({ partnerId: partner.id, creditLimit: Number(creditLimit) }), "Límite de crédito actualizado.")} className={secondaryButtonClass}>Guardar límite</button></div><div className="grid gap-2 border-t border-black/70 pt-3 md:grid-cols-[minmax(0,1fr)_auto]"><label><span className="mb-1 block text-xs font-black uppercase text-slate-400">Nueva contraseña</span><input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" /></label><button disabled={isPending || password.length < 6} onClick={() => onRun(() => resetDistributionPartnerPasswordAction({ partnerId: partner.id, password }), "Contraseña de acceso actualizada.")} className={`${secondaryButtonClass} self-end`}><KeyRound className="h-4 w-4" /> Restablecer</button></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/70 pt-3"><span className="text-sm font-bold text-slate-300">No se elimina una cuenta con historial. Pausarla bloquea su acceso y nuevas ventas.</span><button disabled={isPending} onClick={() => onRun(() => setDistributionPartnerStatusAction({ partnerId: partner.id, isActive: !partner.isActive }), partner.isActive ? "Distribuidor pausado y acceso bloqueado." : "Distribuidor reactivado.")} className={partner.isActive ? secondaryButtonClass : primaryButtonClass}>{partner.isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}{partner.isActive ? "Pausar distribuidor" : "Reactivar distribuidor"}</button></div></section>;
}

function DistributorWorkspace({ partner, isPending, message, onRun }: { partner: DistributionPartner | null; isPending: boolean; message: string | null; onRun: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => void }) {
  const [offerId, setOfferId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  if (!partner) return <Panel title="Mi distribuidora"><p className="text-slate-300">Tu cuenta no está vinculada a una matriz activa.</p></Panel>;
  const sellable = partner.offers.filter((offer) => offer.isActive && offer.publicPrice);
  return <div className="space-y-4"><Panel title="Mi distribuidora"><div className="grid gap-3 md:grid-cols-3"><StatCard label="Saldo con matriz" value={money(partner.balance)} tone="text-amber-300" /><StatCard label="Crédito disponible" value={money(partner.availableCredit)} tone="text-emerald-300" /><StatCard label="Productos activos" value={String(partner.offers.filter((offer) => offer.isActive).length)} tone="text-slate-100" /></div></Panel><Notice message={message} /><Panel title="Mi precio público"><p className="mb-3 text-sm font-bold text-slate-300">La matriz monitorea este precio. Tu deuda siempre es la tarifa interna acordada.</p><div className="grid gap-2">{partner.offers.map((offer) => <div key={offer.id} className="grid gap-2 rounded-lg border border-black bg-surface-inset p-3 md:grid-cols-[1fr_9rem_9rem_auto] md:items-center"><span><b className="block text-slate-100">{offer.productName}</b><small className="text-slate-400">{offer.countryName}</small></span><b className="text-slate-200">Interno {money(offer.wholesalePrice)}</b><input className={fieldClass} inputMode="decimal" value={prices[offer.id] ?? String(offer.publicPrice || "")} onChange={(event) => setPrices((current) => ({ ...current, [offer.id]: event.target.value }))} placeholder="Precio público" /><button disabled={isPending || !offer.isActive} onClick={() => onRun(() => setDistributionPublicPriceAction({ offerId: offer.id, publicPrice: Number(prices[offer.id] ?? offer.publicPrice) }), "Precio público actualizado.")} className={primaryButtonClass}>Guardar</button></div>)}</div></Panel><Panel title="Registrar venta"><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><select className={fieldClass} value={offerId} onChange={(event) => setOfferId(event.target.value)}><option value="">Producto</option>{sellable.map((offer) => <option key={offer.id} value={offer.id}>{offer.countryName} · {offer.productName} · público {money(offer.publicPrice)}</option>)}</select><input className={fieldClass} value={customerName} onChange={(event) => setCustomerName(formatPersonNameInput(event.target.value))} placeholder="Nombre del cliente" /><button disabled={isPending || !offerId || !customerName.trim()} onClick={() => onRun(() => createDistributionSaleAction({ offerId, customerName }), "Venta enviada a la logística de la matriz.")} className={primaryButtonClass}><PackagePlus className="h-4 w-4" /> Crear envío</button></div></Panel><DistributionShipments partner={partner} /></div>;
}

function Ledger({ entries }: { entries: DistributionPartner["ledger"] }) {
  return <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">{entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm"><span className="min-w-0"><b className="block truncate text-slate-100">{entry.note || entry.shipmentCode || "Movimiento"}</b><small className="text-slate-400">{formatDate(entry.createdAt)} · {entry.kind}</small></span><b className={entry.amount > 0 ? "text-amber-300" : "text-emerald-300"}>{entry.amount > 0 ? "+" : ""}{money(entry.amount)}</b></div>)}{!entries.length ? <p className="rounded-lg border border-dashed border-black p-4 text-sm font-bold text-slate-400">No hay movimientos.</p> : null}</div>;
}

function DistributionShipments({ partner, showPublicPrice = false }: { partner: DistributionPartner; showPublicPrice?: boolean }) {
  return <div className="grid gap-2">{partner.shipments.map((shipment) => <div key={shipment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm"><span><b className="block text-slate-100">{shipment.code}</b><small className="text-slate-400">{formatDate(shipment.createdAt)}</small></span><span className="font-bold text-slate-300">{shipment.status}</span>{showPublicPrice ? <b className="text-slate-100">Público {money(shipment.publicPrice)}</b> : null}</div>)}{!partner.shipments.length ? <p className="rounded-lg border border-dashed border-black p-4 text-sm font-bold text-slate-400">Todavía no hay envíos.</p> : null}</div>;
}
