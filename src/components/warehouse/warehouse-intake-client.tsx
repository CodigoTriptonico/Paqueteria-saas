"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  History,
  MapPin,
  PackageCheck,
  RotateCcw,
  ScanLine,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { WarehouseTruckArrival } from "@/app/actions/physical-packages";
import {
  closeWarehouseIntakeAction,
  openFoundWarehouseIntakeAction,
  openWarehouseIntakeAction,
  reopenWarehouseIntakeAction,
  scanFoundWarehouseIntakePackageAction,
  scanWarehouseIntakePackageAction,
} from "@/app/actions/warehouse-intake";
import { usePageViewLayout } from "@/components/ui/ui-surface-preferences-provider";
import { useSetShellConfig } from "@/components/app-frame";
import {
  inputClass,
  labelMutedClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { formatWarehouseDateTime } from "@/lib/warehouse-timing";
import {
  warehouseIntakeConditionLabel,
  warehouseIntakeConditions,
  warehouseIntakeNeedsDriverConfirmation,
  type WarehouseIntakeAvailablePackage,
  type WarehouseIntakeCondition,
  type WarehouseIntakeItem,
  type WarehouseIntakeSession,
  type WarehouseIntakeWorkspace,
} from "@/lib/warehouse-intake";

type DrawerView = "pending" | "received" | "differences" | "history" | null;

function operationKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function isOpenSession(session: WarehouseIntakeSession) {
  return session.status === "unloading" || session.status === "in_review";
}

function isDifference(item: WarehouseIntakeItem) {
  return item.matchStatus !== "expected" || item.condition !== "correct" || item.weightOutOfTolerance;
}

function statusLabel(session: WarehouseIntakeSession) {
  if (session.status === "unloading") return "Descargando";
  if (session.status === "in_review") return "En revisión";
  if (session.status === "completed_with_exceptions") return "Cerrado con diferencias";
  if (session.status === "completed") return "Completado";
  return "Cancelado";
}

function metricTone(value: number, warning = false) {
  if (!value) return "text-slate-500";
  return warning ? "text-amber-300" : "text-slate-100";
}

function IntakeInfoDisclosure({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <details className="group relative shrink-0">
      <summary aria-label={ariaLabel} className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-slate-600 text-xs font-black text-slate-300 transition hover:border-slate-400 hover:bg-surface-inset hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 [&::-webkit-details-marker]:hidden">!</summary>
      <div className="fixed inset-x-4 top-1/2 z-30 max-w-none -translate-y-1/2 rounded-lg border border-black bg-surface-panel px-3 py-2.5 text-sm font-bold leading-snug text-slate-200 shadow-xl sm:absolute sm:left-0 sm:top-full sm:mt-2 sm:w-72 sm:max-w-[calc(100vw-2rem)] sm:translate-y-0">
        {children}
      </div>
    </details>
  );
}

function IntakeItemRow({ item }: { item: WarehouseIntakeItem }) {
  const difference = isDifference(item);
  return (
    <article className="rounded-lg border border-black bg-surface-card p-3 shadow-[0_5px_16px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-black text-slate-100">{item.scannedCode}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-400">
            {item.package?.recipientName || item.package?.customerName || "Caja sin identificar"}
            {item.package?.country ? ` · ${item.package.country}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${difference ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>
          {warehouseIntakeConditionLabel[item.condition]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-black pt-2 text-xs font-bold text-slate-400">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.locationLabel}</span>
        {item.receivedWeightKg ? <span>{item.receivedWeightKg.toFixed(2)} kg</span> : null}
        <span>{formatWarehouseDateTime(item.scannedAt)}</span>
      </div>
      {item.note ? <p className="mt-2 text-xs font-bold leading-5 text-amber-100/80">{item.note}</p> : null}
      {item.evidenceUrl ? (
        <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-300 hover:text-emerald-200">
          <Camera className="h-3.5 w-3.5" /> Ver foto
        </a>
      ) : null}
    </article>
  );
}

function AvailablePackageRow({ pkg, expected = true }: { pkg: WarehouseIntakeAvailablePackage; expected?: boolean }) {
  return (
    <article className="rounded-lg border border-black bg-surface-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-black text-slate-100">{pkg.code}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-400">{pkg.recipientName || pkg.customerName} · {pkg.country}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-black ${expected ? "bg-slate-700 text-slate-200" : "bg-amber-400/15 text-amber-200"}`}>
          {expected ? "Pendiente" : "Otra ruta"}
        </span>
      </div>
      <p className="mt-2 text-xs font-black text-emerald-200">Factura {pkg.invoiceCode}</p>
    </article>
  );
}

function Drawer({
  view,
  session,
  workspace,
  onClose,
  onReopen,
}: {
  view: Exclude<DrawerView, null>;
  session: WarehouseIntakeSession | null;
  workspace: WarehouseIntakeWorkspace;
  onClose: () => void;
  onReopen: (session: WarehouseIntakeSession) => void;
}) {
  const { layout } = usePageViewLayout("warehouse.intake");
  const pending = session
    ? workspace.availablePackages.filter((pkg) => pkg.truckRouteId === session.routeId)
    : [];
  const received = session?.items || [];
  const differences = received.filter(isDifference);
  const title = view === "pending" ? "Cajas pendientes" : view === "received" ? "Cajas ingresadas" : view === "differences" ? "Diferencias" : "Ingresos cerrados";
  return (
    <div className="fixed inset-0 z-[145] flex justify-end bg-black/70" role="presentation">
      <button type="button" aria-label="Cerrar panel" className="absolute inset-0" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="warehouse-intake-drawer-title" className="relative flex h-full w-full max-w-lg flex-col border-l border-black bg-surface-panel shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-black p-4 sm:p-5">
          <div>
            <p className={labelMutedClass}>Ingreso a bodega</p>
            <h2 id="warehouse-intake-drawer-title" className="mt-1 text-xl font-black text-slate-100">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-200" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-5">
          <div className={layout === "cards" ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
            {view === "pending" ? pending.map((pkg) => <AvailablePackageRow key={pkg.id} pkg={pkg} />) : null}
            {view === "received" ? received.map((item) => <IntakeItemRow key={item.id} item={item} />) : null}
            {view === "differences" ? differences.map((item) => <IntakeItemRow key={item.id} item={item} />) : null}
            {view === "history" ? workspace.sessions.filter((entry) => !isOpenSession(entry)).map((entry) => (
              <article key={entry.id} className="rounded-xl border border-black bg-surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-black text-emerald-200">{entry.code}</p>
                    <p className="mt-1 font-black text-slate-100">{entry.routeName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{entry.vehicleName} · {entry.driverName}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${entry.status === "completed" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{statusLabel(entry)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black pt-3 text-center">
                  <div><p className="text-lg font-black text-slate-100">{entry.summary.received}</p><p className="text-[11px] font-bold text-slate-500">Recibidas</p></div>
                  <div><p className="text-lg font-black text-amber-300">{entry.summary.missing}</p><p className="text-[11px] font-bold text-slate-500">Faltantes</p></div>
                  <div><p className="text-lg font-black text-amber-300">{entry.summary.quarantine}</p><p className="text-[11px] font-bold text-slate-500">Cuarentena</p></div>
                </div>
                {workspace.canReopen ? <button type="button" onClick={() => onReopen(entry)} className={`${secondaryButtonClass} mt-3 h-9 w-full text-xs`}><RotateCcw className="h-4 w-4" />Reabrir con motivo</button> : null}
              </article>
            )) : null}
          </div>
          {view === "pending" && !pending.length ? <p className="py-12 text-center text-sm font-bold text-slate-500">No quedan cajas esperadas sin escanear.</p> : null}
          {view === "received" && !received.length ? <p className="py-12 text-center text-sm font-bold text-slate-500">Todavía no se han ingresado cajas.</p> : null}
          {view === "differences" && !differences.length ? <p className="py-12 text-center text-sm font-bold text-slate-500">No hay diferencias registradas.</p> : null}
          {view === "history" && !workspace.sessions.some((entry) => !isOpenSession(entry)) ? <p className="py-12 text-center text-sm font-bold text-slate-500">No hay ingresos cerrados.</p> : null}
        </div>
      </section>
    </div>
  );
}

export function WarehouseIntakeClient({
  initialWorkspace,
  initialTruckArrivals = [],
  initialError = "",
}: {
  initialWorkspace: WarehouseIntakeWorkspace;
  initialTruckArrivals?: WarehouseTruckArrival[];
  initialError?: string;
}) {
  const notify = useNotify();
  const setShellConfig = useSetShellConfig();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [trucks, setTrucks] = useState(initialTruckArrivals);
  const initialOpen = initialWorkspace.sessions.find(isOpenSession)?.id || "";
  const [activeSessionId, setActiveSessionId] = useState(initialOpen);
  const [selectedTruckId, setSelectedTruckId] = useState(initialTruckArrivals[0]?.routeId || "");
  const [warehouseId, setWarehouseId] = useState(initialTruckArrivals[0]?.arrivalWarehouseId || initialWorkspace.warehouses.find((warehouse) => warehouse.isDefault)?.id || initialWorkspace.warehouses[0]?.id || "");
  const [opening, setOpening] = useState(false);
  const [code, setCode] = useState("");
  const [weight, setWeight] = useState("");
  const [binId, setBinId] = useState("");
  const [condition, setCondition] = useState<WarehouseIntakeCondition>("correct");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidenceInputKey, setEvidenceInputKey] = useState(0);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState(initialError);
  const [lastReceived, setLastReceived] = useState<WarehouseIntakeItem | null>(null);
  const [drawer, setDrawer] = useState<DrawerView>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [driverConfirmed, setDriverConfirmed] = useState(false);
  const [receiverConfirmed, setReceiverConfirmed] = useState(false);
  const [driverNote, setDriverNote] = useState("");
  const [closeError, setCloseError] = useState("");
  const [reopenTarget, setReopenTarget] = useState<WarehouseIntakeSession | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShellConfig({ contentEdgeToEdge: true });
    return () => setShellConfig({ contentEdgeToEdge: undefined });
  }, [setShellConfig]);

  const openSessions = workspace.sessions.filter(isOpenSession);
  const activeSession = openSessions.find((session) => session.id === activeSessionId) || openSessions[0] || null;
  const selectedTruck = trucks.find((truck) => truck.routeId === selectedTruckId) || null;
  const selectedPackage = useMemo(() => workspace.availablePackages.find((pkg) => pkg.code.toLowerCase() === code.trim().toLowerCase()) || null, [code, workspace.availablePackages]);
  const isFoundIntake = activeSession?.intakeKind === "found_in_warehouse";
  const needsDriverConfirmation = activeSession ? warehouseIntakeNeedsDriverConfirmation(activeSession.intakeKind) : false;
  const expectedReceived = activeSession?.items.filter((item) => item.matchStatus === "expected").length || 0;
  const progress = activeSession?.expectedCount ? Math.min(100, Math.round(expectedReceived / activeSession.expectedCount * 100)) : 0;
  const pendingCount = Math.max(0, (activeSession?.expectedCount || 0) - expectedReceived);
  const differences = activeSession?.items.filter(isDifference).length || 0;
  const enteredWeight = Number(weight.replace(",", "."));
  const weightDifference = selectedPackage?.collectionWeightKg && enteredWeight > 0 ? Math.abs(enteredWeight - selectedPackage.collectionWeightKg) : 0;
  const weightWarning = Boolean(selectedPackage && weightDifference > workspace.toleranceKg);
  const sessionBins = workspace.bins.filter((bin) => bin.warehouseId === activeSession?.warehouseId);

  function resetScanner() {
    setCode("");
    setWeight("");
    setBinId("");
    setCondition("correct");
    setNote("");
    setEvidence(null);
    setEvidenceInputKey((value) => value + 1);
    setIssueError("");
    requestAnimationFrame(() => codeRef.current?.focus());
  }

  function acceptWorkspace(next: WarehouseIntakeWorkspace, preferredSessionId = activeSession?.id || "") {
    setWorkspace(next);
    const nextOpen = next.sessions.find((session) => session.id === preferredSessionId && isOpenSession(session))
      || next.sessions.find(isOpenSession);
    setActiveSessionId(nextOpen?.id || "");
  }

  async function openIntake() {
    if (!selectedTruck || !warehouseId) {
      setInlineError("Selecciona el camión y la bodega que recibirá la carga.");
      return;
    }
    setOpening(true);
    setInlineError("");
    try {
      const result = await openWarehouseIntakeAction({ routeId: selectedTruck.routeId, warehouseId, operationKey: operationKey() });
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      const openedSession = result.data.sessions.find((session) => session.routeId === selectedTruck.routeId && isOpenSession(session));
      acceptWorkspace(result.data, openedSession?.id || "");
      setTrucks((current) => current.filter((truck) => truck.routeId !== selectedTruck.routeId));
      notify.success(`${selectedTruck.packageCount} cajas listas para escanear.`);
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      setOpening(false);
    }
  }

  async function openFoundIntake() {
    if (!warehouseId) {
      setInlineError("Selecciona la bodega donde encontraste la caja.");
      return;
    }
    setOpening(true);
    setInlineError("");
    try {
      const result = await openFoundWarehouseIntakeAction({ warehouseId, operationKey: operationKey() });
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      const openedSession = result.data.sessions.find((session) => session.intakeKind === "found_in_warehouse" && isOpenSession(session));
      acceptWorkspace(result.data, openedSession?.id || "");
      setDriverConfirmed(true);
      notify.success("Ingreso sin manifiesto abierto. Documenta la caja antes de aceptarla.");
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      setOpening(false);
    }
  }

  function prepareScannedCode() {
    if (!code.trim()) {
      setInlineError("Escanea o escribe el código de la caja.");
      codeRef.current?.focus();
      return;
    }
    setInlineError("");
    if (isFoundIntake || !selectedPackage) {
      setCondition("unidentified");
      setIssueOpen(true);
      return;
    }
    weightRef.current?.focus();
  }

  async function receive() {
    if (!activeSession || saving) return;
    setSaving(true);
    setInlineError("");
    try {
      const form = new FormData();
      form.set("sessionId", activeSession.id);
      form.set("code", code.trim());
      form.set("weightKg", weight);
      form.set("condition", condition);
      form.set("note", note);
      form.set("binId", binId);
      form.set("operationKey", operationKey());
      if (evidence) form.set("evidence", evidence);
      const result = isFoundIntake
        ? await scanFoundWarehouseIntakePackageAction(form)
        : await scanWarehouseIntakePackageAction(form);
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      const updatedSession = result.data.sessions.find((session) => session.id === activeSession.id);
      const receivedItem = updatedSession?.items.find((item) => item.scannedCode.toLowerCase() === code.trim().toLowerCase()) || null;
      acceptWorkspace(result.data, activeSession.id);
      setLastReceived(receivedItem);
      notify.success(`${code.trim()} ingresada.`);
      resetScanner();
    } finally {
      setSaving(false);
    }
  }

  async function closeIntake() {
    if (!activeSession) return;
    setClosing(true);
    setCloseError("");
    try {
      const result = await closeWarehouseIntakeAction({
        sessionId: activeSession.id,
        driverConfirmed,
        driverExceptionNote: driverNote,
        receiverConfirmed,
        operationKey: operationKey(),
      });
      if (!result.ok) {
        setCloseError(result.error);
        return;
      }
      acceptWorkspace(result.data, activeSession.id);
      setCloseOpen(false);
      setDriverConfirmed(false);
      setReceiverConfirmed(false);
      setDriverNote("");
      setLastReceived(null);
      notify.success(`${activeSession.code} cerrado.`);
      setDrawer("history");
    } finally {
      setClosing(false);
    }
  }

  async function reopenIntake() {
    if (!reopenTarget) return;
    setReopening(true);
    setInlineError("");
    try {
      const result = await reopenWarehouseIntakeAction({ sessionId: reopenTarget.id, reason: reopenReason, operationKey: operationKey() });
      if (!result.ok) {
        setInlineError(result.error);
        return;
      }
      acceptWorkspace(result.data, reopenTarget.id);
      setReopenTarget(null);
      setReopenReason("");
      setDrawer(null);
      notify.success(`${reopenTarget.code} reabierto con auditoría.`);
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      setReopening(false);
    }
  }

  function saveIssue() {
    if (!note.trim()) return setIssueError("Describe cómo llegó la caja.");
    if (!evidence) return setIssueError("Toma una foto antes de continuar.");
    setIssueError("");
    setIssueOpen(false);
    requestAnimationFrame(() => selectedPackage ? weightRef.current?.focus() : codeRef.current?.focus());
  }

  return (
    <Panel title="Ingreso a bodega" hideHeader className="min-h-0" contentClassName="p-0">
      <div className="min-h-full p-3 pb-24 sm:p-5 sm:pb-10">
        {!activeSession ? (
          <div className="w-full max-w-none">
            <header className="rounded-xl border border-black bg-surface-card p-3 shadow-[0_10px_28px_rgba(0,0,0,0.2)] sm:p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300"><Warehouse className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className={labelMutedClass}>Custodia de bodega</p>
                  <div className="mt-0.5 flex items-center gap-2"><h1 className="text-xl font-black tracking-tight text-slate-100">Abrir ingreso</h1><IntakeInfoDisclosure ariaLabel="Ver ayuda de apertura de ingreso">Recibe un manifiesto cuando llega un camión o registra una caja encontrada sin camión ni ruta.</IntakeInfoDisclosure></div>
                </div>
                <button type="button" onClick={() => setDrawer("history")} className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300" aria-label="Ver ingresos cerrados"><History className="h-4 w-4" /></button>
              </div>
            </header>
            {inlineError ? <div role="alert" className="mt-3 flex items-start gap-3 rounded-xl border border-rose-900 bg-rose-950/35 p-3 text-sm font-bold text-rose-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{inlineError}</span></div> : null}
            <section className="mt-3 rounded-xl border border-black bg-surface-card p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className={labelMutedClass}>Llegadas listas</p><h2 className="mt-1 text-lg font-black text-slate-100">Selecciona el camión</h2></div>
                <span className="rounded-full bg-surface-inset px-3 py-1 text-xs font-black text-slate-300">{trucks.length}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {trucks.map((truck) => {
                  const selected = truck.routeId === selectedTruckId;
                  return <button key={truck.routeId} type="button" onClick={() => { setSelectedTruckId(truck.routeId); if (truck.arrivalWarehouseId) setWarehouseId(truck.arrivalWarehouseId); }} className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-emerald-500 bg-emerald-950/35" : "border-black bg-surface-inset hover:bg-surface-card-hover"}`}>
                    <div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg border border-black ${selected ? "bg-emerald-400 text-slate-950" : "bg-surface-card text-slate-300"}`}><Truck className="h-5 w-5" /></span><span className="text-2xl font-black tabular-nums text-slate-100">{truck.packageCount}</span></div>
                    <p className="mt-3 font-black text-slate-100">{truck.routeName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{truck.vehicleName} · {truck.driverName}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-slate-300"><MapPin className="h-3.5 w-3.5" />{truck.arrivalWarehouseName}</p>
                    {truck.arrivalReason ? <p className="mt-1 text-xs font-bold leading-4 text-slate-400">Motivo: {truck.arrivalReason}</p> : null}
                    <p className="mt-2 text-xs font-black text-emerald-200">{truck.packageCount} cajas esperadas</p>
                  </button>;
                })}
              </div>
              {!trucks.length ? <div className="mt-3 flex min-h-16 items-center justify-center gap-2 rounded-lg border border-black bg-surface-inset/40 px-3 py-3 text-center"><Truck className="h-5 w-5 shrink-0 text-slate-600" /><p className="font-black text-slate-300">No hay camiones pendientes.</p><IntakeInfoDisclosure ariaLabel="Ver por qué no hay camiones">Una ruta aparece aquí cuando el conductor recoge cajas y llega a esta bodega.</IntakeInfoDisclosure></div> : null}
              {selectedTruck ? <div className="mt-4 grid gap-3 border-t border-black pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                {selectedTruck.arrivalWarehouseId ? <div className="rounded-xl border border-black bg-surface-inset p-3"><p className={labelMutedClass}>El conductor dejó la ruta en</p><p className="mt-1 flex items-center gap-2 font-black text-slate-100"><Warehouse className="h-4 w-4 text-emerald-300" />{selectedTruck.arrivalWarehouseName}</p></div> : <label className="grid gap-1.5"><span className={labelMutedClass}>Bodega que recibe</span><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={`${inputClass} h-11 w-full`}>{workspace.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>}
                <button type="button" disabled={opening || !warehouseId} onClick={() => void openIntake()} className={`${primaryButtonClass} h-11 w-full px-5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto`}>{opening ? "Abriendo..." : "Abrir ingreso y descargar"}<ChevronRight className="h-4 w-4" /></button>
              </div> : null}
            </section>
            <section className="mt-2 rounded-xl border border-amber-900/80 bg-amber-950/20 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-900 bg-amber-950/50 text-amber-300"><PackageCheck className="h-4 w-4" /></span>
                <div className="flex min-w-0 items-center gap-2"><p className={labelMutedClass}>Sin camión</p><h2 className="truncate text-base font-black text-slate-100">Caja encontrada</h2><IntakeInfoDisclosure ariaLabel="Ver ayuda para caja encontrada">Regístrala aunque no sepas de dónde vino. Quedará en Cuarentena hasta aclarar su origen.</IntakeInfoDisclosure></div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(11rem,1fr)_auto] sm:items-center">
                <label><span className="sr-only">Bodega donde la encontré</span><select aria-label="Bodega donde la encontré" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={`${inputClass} h-11 w-full`}>{workspace.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
                <button type="button" disabled={opening || !warehouseId} onClick={() => void openFoundIntake()} className={`${primaryButtonClass} h-11 w-full px-5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto`}>{opening ? "Abriendo..." : "Ingresar caja encontrada"}<ChevronRight className="h-4 w-4" /></button>
              </div>
            </section>
          </div>
        ) : (
          <div className="w-full max-w-none">
            <header className="overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_10px_28px_rgba(0,0,0,0.2)]">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-black text-emerald-300">{activeSession.code}</p><span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] font-black text-emerald-200">{statusLabel(activeSession)}</span></div>
                    <h1 className="mt-2 truncate text-xl font-black text-slate-100 sm:text-2xl">{activeSession.routeName}</h1>
                    <p className="mt-1 truncate text-xs font-bold text-slate-400">{activeSession.vehicleName} · {activeSession.driverName} · {activeSession.warehouseName}</p>
                  </div>
                  <button type="button" onClick={() => setCloseOpen(true)} className={`${secondaryButtonClass} h-10 shrink-0 px-3 text-xs`}><ClipboardCheck className="h-4 w-4" /><span className="hidden sm:inline">Cerrar ingreso</span><span className="sm:hidden">Cerrar</span></button>
                </div>
                {openSessions.length > 1 ? <label className="mt-3 block"><span className="sr-only">Ingreso activo</span><select value={activeSession.id} onChange={(event) => setActiveSessionId(event.target.value)} className={`${inputClass} h-9 w-full text-xs`}>{openSessions.map((session) => <option key={session.id} value={session.id}>{session.code} · {session.routeName}</option>)}</select></label> : null}
                <div className="mt-4 flex items-end justify-between gap-4"><div><p className="text-3xl font-black tabular-nums text-slate-100">{isFoundIntake ? activeSession.items.length : expectedReceived}{isFoundIntake ? null : <span className="text-lg text-slate-500"> / {activeSession.expectedCount}</span>}</p><p className="mt-1 text-xs font-black uppercase text-slate-500">{isFoundIntake ? "Cajas documentadas" : "Cajas recibidas"}</p></div>{isFoundIntake ? <p className="text-xs font-black text-amber-200">Origen por aclarar</p> : <p className="text-2xl font-black tabular-nums text-emerald-300">{progress}%</p>}</div>
                {!isFoundIntake ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-inset"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div> : null}
              </div>
              <div className="grid grid-cols-4 border-t border-black bg-surface-inset/45">
                <button type="button" onClick={() => setDrawer("pending")} className="border-r border-black px-2 py-3 text-center hover:bg-surface-card-hover"><p className={`text-lg font-black tabular-nums ${metricTone(pendingCount, pendingCount > 0)}`}>{pendingCount}</p><p className="text-[10px] font-black uppercase text-slate-500">Pendientes</p></button>
                <button type="button" onClick={() => setDrawer("received")} className="border-r border-black px-2 py-3 text-center hover:bg-surface-card-hover"><p className={`text-lg font-black tabular-nums ${metricTone(activeSession.summary.received)}`}>{activeSession.summary.received}</p><p className="text-[10px] font-black uppercase text-slate-500">Ingresadas</p></button>
                <button type="button" onClick={() => setDrawer("differences")} className="border-r border-black px-2 py-3 text-center hover:bg-surface-card-hover"><p className={`text-lg font-black tabular-nums ${metricTone(differences, true)}`}>{differences}</p><p className="text-[10px] font-black uppercase text-slate-500">Diferencias</p></button>
                <button type="button" onClick={() => setDrawer("history")} className="px-2 py-3 text-center hover:bg-surface-card-hover"><History className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-0.5 text-[10px] font-black uppercase text-slate-500">Historial</p></button>
              </div>
            </header>

            <section className="mt-3 rounded-xl border border-black bg-surface-card p-4 shadow-[0_8px_22px_rgba(0,0,0,0.18)] sm:p-5">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black bg-emerald-400 text-slate-950"><ScanLine className="h-5 w-5" /></span><div><p className={labelMutedClass}>Siguiente caja</p><h2 className="font-black text-slate-100">Escanear y aceptar custodia</h2></div></div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_8rem_minmax(0,1fr)_auto] lg:items-end">
                <label className="grid gap-1.5 lg:col-span-1"><span className={labelMutedClass}>Código de caja</span><input ref={codeRef} autoFocus value={code} onChange={(event) => { setCode(event.target.value); setInlineError(""); setLastReceived(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); prepareScannedCode(); } }} className={`${inputClass} h-12 w-full font-mono text-base font-black`} placeholder="Escanea o escribe el código" autoComplete="off" /></label>
                <label className="grid gap-1.5"><span className={labelMutedClass}>Peso kg</span><input ref={weightRef} value={weight} onChange={(event) => { setWeight(event.target.value); setInlineError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void receive(); } }} className={`${inputClass} h-12 w-full text-base font-black tabular-nums`} inputMode="decimal" placeholder="0.00" /></label>
                <label className="grid gap-1.5"><span className={labelMutedClass}>Ubicación inicial</span><select value={binId} onChange={(event) => setBinId(event.target.value)} disabled={isFoundIntake || condition !== "correct" || weightWarning || Boolean(selectedPackage && selectedPackage.truckRouteId !== activeSession.routeId)} className={`${inputClass} h-12 w-full disabled:cursor-not-allowed disabled:opacity-50`}><option value="">{isFoundIntake ? "Cuarentena obligatoria" : "Recepción pendiente"}</option>{sessionBins.map((bin) => <option key={bin.id} value={bin.id}>{bin.code} · {bin.label}</option>)}</select></label>
                <button type="button" disabled={saving || !code.trim() || (!selectedPackage && condition !== "unidentified") || (Boolean(selectedPackage) && !(enteredWeight > 0)) || (weightWarning && !note.trim()) || (isFoundIntake && (!note.trim() || !evidence))} onClick={() => void receive()} className={`${primaryButtonClass} h-12 w-full px-5 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto`}>{saving ? "Guardando..." : "Confirmar ingreso"}<Check className="h-4 w-4" /></button>
              </div>

              {selectedPackage ? <div className="mt-3 rounded-xl border border-black bg-surface-inset/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-black text-slate-100">{selectedPackage.code}</p><p className="mt-1 text-xs font-bold text-slate-400">{selectedPackage.recipientName || selectedPackage.customerName} · {selectedPackage.country}</p><p className="mt-1 text-xs font-black text-emerald-200">Factura {selectedPackage.invoiceCode}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setCondition("correct"); setNote(""); setEvidence(null); }} className={`h-9 rounded-lg border px-3 text-xs font-black ${condition === "correct" ? "border-emerald-500 bg-emerald-400 text-slate-950" : "border-black bg-surface-card text-slate-200"}`}><CheckCircle2 className="mr-1 inline h-4 w-4" />Correcta</button><button type="button" onClick={() => setIssueOpen(true)} className={`h-9 rounded-lg border px-3 text-xs font-black ${condition !== "correct" ? "border-amber-600 bg-amber-950/50 text-amber-100" : "border-black bg-surface-card text-slate-200"}`}><AlertTriangle className="mr-1 inline h-4 w-4" />Con problema</button></div></div>
                {isFoundIntake ? <p role="alert" className="mt-3 rounded-lg bg-amber-950/45 px-3 py-2 text-xs font-black text-amber-100">Origen sin identificar. Se registrará en Cuarentena con una excepción de custodia abierta.</p> : selectedPackage.truckRouteId !== activeSession.routeId ? <p role="alert" className="mt-3 rounded-lg bg-amber-950/45 px-3 py-2 text-xs font-black text-amber-100">No pertenece a este manifiesto. Se registrará como sobrante y quedará en Cuarentena.</p> : null}
                {selectedPackage.paymentStatus === "pending" ? <p className="mt-2 rounded-lg bg-surface-card px-3 py-2 text-xs font-bold text-slate-300"><span className="font-black text-amber-300">Pago pendiente.</span> La recepción física continúa, pero la caja sigue bloqueada para despacho.</p> : null}
                {weightWarning ? <div role="alert" className="mt-2 rounded-lg border border-amber-900 bg-amber-950/35 p-3"><p className="text-xs font-black text-amber-100">Diferencia de {weightDifference.toFixed(2)} kg. La tolerancia es {workspace.toleranceKg.toFixed(2)} kg y la caja irá a Cuarentena.</p><label className="mt-2 grid gap-1"><span className="text-[11px] font-black uppercase text-amber-200/70">Motivo de la diferencia</span><input value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} h-10 w-full`} placeholder="Ej. báscula de origen descalibrada" /></label></div> : null}
                {condition !== "correct" ? <p className="mt-2 text-xs font-black text-amber-200">{warehouseIntakeConditionLabel[condition]} · Foto lista · Cuarentena</p> : null}
              </div> : code.trim() ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-900 bg-amber-950/35 p-3"><div><p className="text-sm font-black text-amber-100">Código no registrado</p><p className="mt-1 text-xs font-bold text-amber-200/70">Puedes documentarlo sin detener la descarga.</p></div><button type="button" onClick={() => { setCondition("unidentified"); setIssueOpen(true); }} className="h-9 rounded-lg border border-amber-700 bg-amber-950 px-3 text-xs font-black text-amber-100"><Camera className="mr-1 inline h-4 w-4" />Registrar sin identificar</button></div> : null}

              {inlineError ? <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-rose-900 bg-rose-950/35 p-3 text-sm font-bold text-rose-100"><AlertTriangle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{inlineError}</span><button type="button" onClick={() => void receive()} disabled={saving} className="h-8 rounded-lg border border-rose-700 px-3 text-xs font-black hover:bg-rose-900/40 disabled:opacity-40">Intentar otra vez</button></div> : null}
              {lastReceived ? <div aria-live="polite" className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-3"><PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-sm font-black text-emerald-100">{lastReceived.scannedCode} ingresada correctamente</p><p className="mt-1 text-xs font-bold text-emerald-200/70">{warehouseIntakeConditionLabel[lastReceived.condition]} · {lastReceived.locationLabel} · Custodia transferida a {activeSession.warehouseName}</p></div></div> : null}
            </section>
          </div>
        )}
      </div>

      {drawer ? <Drawer view={drawer} session={activeSession} workspace={workspace} onClose={() => setDrawer(null)} onReopen={(session) => { setReopenTarget(session); setReopenReason(""); }} /> : null}

      {issueOpen ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"><button type="button" aria-label="Cerrar condición" className="absolute inset-0" onClick={() => setIssueOpen(false)} /><section role="dialog" aria-modal="true" aria-labelledby="warehouse-condition-title" className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-black bg-surface-panel p-4 pb-8 shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><p className={labelMutedClass}>{isFoundIntake ? "Custodia por aclarar" : "Excepción física"}</p><h2 id="warehouse-condition-title" className="mt-1 text-xl font-black text-slate-100">{isFoundIntake ? "Dónde encontraste la caja" : "Cómo llegó la caja"}</h2></div><button type="button" onClick={() => setIssueOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300" aria-label="Cerrar"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 grid grid-cols-2 gap-2">{warehouseIntakeConditions.filter((value) => value !== "correct" && (selectedPackage ? value !== "unidentified" : value === "unidentified")).map((value) => <button key={value} type="button" onClick={() => setCondition(value)} className={`min-h-11 rounded-lg border px-3 text-left text-xs font-black ${condition === value ? "border-amber-500 bg-amber-950/55 text-amber-100" : "border-black bg-surface-inset text-slate-300"}`}>{warehouseIntakeConditionLabel[value]}</button>)}</div>
        <label className="mt-4 grid gap-1.5"><span className={labelMutedClass}>Observación obligatoria</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} min-h-24 w-full resize-y py-3`} placeholder={isFoundIntake ? "Ej. junto a la puerta 2, sin etiqueta visible" : "Describe el daño, la etiqueta o por qué no se identifica"} /></label>
        <label className="mt-4 flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-surface-inset p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card text-amber-300"><Camera className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-sm font-black text-slate-100">{evidence ? evidence.name : "Tomar foto"}</span><span className="mt-1 block text-xs font-bold text-slate-500">JPG, PNG o WebP · máximo 8 MB</span></span><input key={evidenceInputKey} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] || null)} /></label>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-950/35 px-3 py-2 text-xs font-black text-amber-100"><MapPin className="h-4 w-4 shrink-0" />La caja quedará en Cuarentena.</div>
        {issueError ? <p role="alert" className="mt-3 text-sm font-black text-rose-200">{issueError}</p> : null}
        <button type="button" onClick={saveIssue} className={`${primaryButtonClass} mt-4 h-11 w-full`}>Guardar condición</button>
      </section></div> : null}

      {closeOpen && activeSession ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"><button type="button" aria-label="Cancelar cierre" className="absolute inset-0" onClick={() => setCloseOpen(false)} disabled={closing} /><section role="dialog" aria-modal="true" aria-labelledby="warehouse-close-title" className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-black bg-surface-panel p-4 pb-8 shadow-2xl sm:rounded-2xl sm:p-5">
        <p className={labelMutedClass}>Conciliación final</p><h2 id="warehouse-close-title" className="mt-1 text-xl font-black text-slate-100">Cerrar {activeSession.code}</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">{[["Recibidas", activeSession.summary.received], ["Faltantes", pendingCount], ["Sobrantes", activeSession.summary.unexpected], ["Dañadas", activeSession.summary.damaged], ["Sin identificar", activeSession.summary.unidentified], ["Cuarentena", activeSession.summary.quarantine]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-black bg-surface-card p-2 text-center"><p className={`text-xl font-black ${Number(value) ? "text-amber-300" : "text-slate-100"}`}>{value}</p><p className="text-[10px] font-black uppercase text-slate-500">{label}</p></div>)}</div>
        {pendingCount || differences ? <p className="mt-3 rounded-lg bg-amber-950/35 px-3 py-2 text-xs font-bold text-amber-100">El ingreso se cerrará con excepciones abiertas. La operación puede continuar y cada diferencia quedará trazada.</p> : <p className="mt-3 rounded-lg bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-100">El manifiesto está conciliado sin diferencias.</p>}
        {needsDriverConfirmation ? <label className="mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-black bg-surface-inset px-3"><input type="checkbox" checked={driverConfirmed} onChange={(event) => setDriverConfirmed(event.target.checked)} className="h-5 w-5 accent-emerald-400" /><span className="text-sm font-black text-slate-200">El conductor confirma la entrega</span></label> : <p className="mt-4 rounded-lg bg-amber-950/35 px-3 py-2 text-xs font-bold text-amber-100">Sin conductor ni manifiesto: esta caja queda con custodia pendiente de aclarar.</p>}
        {!driverConfirmed ? <label className="mt-2 grid gap-1.5"><span className={labelMutedClass}>Por qué no confirmó</span><input value={driverNote} onChange={(event) => setDriverNote(event.target.value)} className={`${inputClass} h-11 w-full`} placeholder="Ej. conductor no disponible" /></label> : null}
        <label className="mt-2 flex min-h-12 items-center gap-3 rounded-lg border border-black bg-surface-inset px-3"><input type="checkbox" checked={receiverConfirmed} onChange={(event) => setReceiverConfirmed(event.target.checked)} className="h-5 w-5 accent-emerald-400" /><span className="text-sm font-black text-slate-200">Confirmo como encargado de bodega</span></label>
        {closeError ? <p role="alert" className="mt-3 text-sm font-black text-rose-200">{closeError}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCloseOpen(false)} disabled={closing} className={`${secondaryButtonClass} h-11`}>Cancelar</button><button type="button" onClick={() => void closeIntake()} disabled={closing} className={`${primaryButtonClass} h-11 disabled:opacity-40`}>{closing ? "Cerrando..." : "Cerrar ingreso"}</button></div>
      </section></div> : null}

      {reopenTarget ? <div className="fixed inset-0 z-[155] flex items-center justify-center bg-black/75 p-4"><button type="button" aria-label="Cancelar reapertura" className="absolute inset-0" onClick={() => setReopenTarget(null)} disabled={reopening} /><section role="dialog" aria-modal="true" aria-labelledby="warehouse-reopen-title" className="relative w-full max-w-sm rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"><p className={labelMutedClass}>Corrección auditada</p><h2 id="warehouse-reopen-title" className="mt-1 text-xl font-black text-slate-100">Reabrir {reopenTarget.code}</h2><p className="mt-2 text-sm font-bold text-slate-400">El cierre anterior se conserva en el historial. Escribe por qué necesitas agregar una corrección.</p><textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} className={`${inputClass} mt-4 min-h-24 w-full py-3`} placeholder="Motivo obligatorio" />{inlineError ? <p role="alert" className="mt-3 text-sm font-black text-rose-200">{inlineError}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setReopenTarget(null)} className={`${secondaryButtonClass} h-11`}>Cancelar</button><button type="button" disabled={reopening || !reopenReason.trim()} onClick={() => void reopenIntake()} className={`${primaryButtonClass} h-11 disabled:opacity-40`}>{reopening ? "Abriendo..." : "Reabrir"}</button></div></section></div> : null}
    </Panel>
  );
}
