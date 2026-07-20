"use client";

import {
  Boxes,
  ClipboardList,
  History,
  Loader2,
  LocateFixed,
  Package,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadInventoryCustodySnapshotAction } from "@/app/actions/inventory-custody";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import {
  InventoryAssignmentsPanelBody,
} from "@/components/inventory-assignments-panel";
import {
  InventoryMovementsSidePanel,
} from "@/components/inventory-movements-panel";
import type { CloseAssignmentSubmit } from "@/components/inventory-assignment-modals";
import {
  EMPTY_CUSTODY_BUCKET_LABELS,
  emptyRowTrackedTotal,
  type EmptyBoxCustodyBuckets,
  type EmptyBoxCustodyRow,
  type FullBoxCustodyBucket,
  type InventoryCustodySnapshot,
} from "@/lib/inventory-custody";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";

export type InventoryTrackingTab = "custody" | "assignments" | "history";

type CustodyKindTab = "empty" | "full";

const trackingTabs: AppTabDefinition<InventoryTrackingTab>[] = [
  { id: "custody", label: "Custodia", icon: LocateFixed },
  { id: "assignments", label: "Asignaciones", icon: ClipboardList },
  { id: "history", label: "Historial", icon: History },
];

const custodyKindTabs: AppTabDefinition<CustodyKindTab>[] = [
  { id: "empty", label: "Vacías", icon: Boxes },
  { id: "full", label: "Llenas", icon: Package },
];

const BUCKET_ORDER: (keyof EmptyBoxCustodyBuckets)[] = [
  "warehouse",
  "assigned",
  "reserved",
  "inTruck",
  "agencyAvailable",
  "agencyAllocated",
  "unavailable",
];

const BUCKET_TONE: Record<keyof EmptyBoxCustodyBuckets, string> = {
  warehouse: "text-emerald-300",
  assigned: "text-sky-300",
  reserved: "text-amber-300",
  inTruck: "text-violet-300",
  agencyAvailable: "text-cyan-300",
  agencyAllocated: "text-orange-300",
  unavailable: "text-rose-300",
};

function MetricChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-black bg-surface-inset/50 px-2.5 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-base font-black tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function EmptyRowCard({ row }: { row: EmptyBoxCustodyRow }) {
  return (
    <article className="rounded-xl border border-black bg-[#111827] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#f8fafc]">{row.itemName}</p>
          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
            {[row.category, row.kind, row.size].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-black bg-surface-inset px-2 py-1 text-xs font-black tabular-nums text-slate-300">
          {emptyRowTrackedTotal(row.buckets)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BUCKET_ORDER.map((key) => (
          <MetricChip
            key={key}
            label={EMPTY_CUSTODY_BUCKET_LABELS[key]}
            value={row.buckets[key]}
            tone={BUCKET_TONE[key]}
          />
        ))}
      </div>
    </article>
  );
}

function FullBucketList({ buckets }: { buckets: FullBoxCustodyBucket[] }) {
  const active = buckets.filter((bucket) => bucket.count > 0);
  const rows = active.length ? active : buckets;

  return (
    <div className="space-y-2">
      {rows.map((bucket) => (
        <div
          key={bucket.status}
          className="flex items-center justify-between gap-3 rounded-xl border border-black bg-[#111827] px-3 py-3"
        >
          <p className="text-sm font-black text-[#f8fafc]">{bucket.label}</p>
          <span className="text-base font-black tabular-nums text-emerald-300">
            {bucket.count}
          </span>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          href="/ingreso-bodega"
          className="rounded-lg border border-black bg-surface-inset px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
        >
          Ingreso bodega
        </Link>
        <Link
          href="/bodega"
          className="rounded-lg border border-black bg-surface-inset px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
        >
          Bodega
        </Link>
        <Link
          href="/paletas"
          className="rounded-lg border border-black bg-surface-inset px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
        >
          Paletas
        </Link>
      </div>
    </div>
  );
}

function CustodyPanel({
  active,
  warehouseId,
  warehouseName,
}: {
  active: boolean;
  warehouseId: string;
  warehouseName?: string;
}) {
  const [kindTab, setKindTab] = useState<CustodyKindTab>("empty");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<InventoryCustodySnapshot | null>(null);

  const reload = useCallback(async () => {
    if (!warehouseId) {
      setError("Selecciona una bodega.");
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError("");
    const result = await loadInventoryCustodySnapshotAction({
      warehouseId,
      warehouseName,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error || "No se pudo cargar la custodia.");
      setSnapshot(null);
      return;
    }

    setSnapshot(result.data);
  }, [warehouseId, warehouseName]);

  useEffect(() => {
    if (!active) {
      return;
    }

    queueMicrotask(() => {
      void reload();
    });
  }, [active, reload]);

  const totals = snapshot?.emptyTotals;
  const emptyBadge = snapshot?.emptyRows.length || undefined;
  const fullBadge = snapshot?.fullTotal || undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-black/70 px-4 py-3">
        <AppTabs
          tabs={custodyKindTabs.map((entry) =>
            entry.id === "empty"
              ? { ...entry, badge: emptyBadge }
              : { ...entry, badge: fullBadge },
          )}
          value={kindTab}
          onChange={setKindTab}
          size="compact"
          ariaLabel="Tipo de caja"
        />
        <p className="mt-2 text-xs font-bold text-slate-500">
          Dónde quedó el stock después de salir de bodega.
        </p>
      </div>

      {totals && kindTab === "empty" ? (
        <div className="shrink-0 grid grid-cols-3 gap-2 border-b border-black/70 px-4 py-3">
          <MetricChip label="Bodega" value={totals.warehouse} tone={BUCKET_TONE.warehouse} />
          <MetricChip label="Camión" value={totals.inTruck} tone={BUCKET_TONE.inTruck} />
          <MetricChip
            label="Agencias"
            value={totals.agencyAvailable}
            tone={BUCKET_TONE.agencyAvailable}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <p className="text-sm font-bold">Cargando custodia…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-400/10 px-4 py-6 text-center">
            <p className="text-sm font-black text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-3 rounded-lg border border-black bg-surface-inset px-3 py-2 text-xs font-black text-slate-300"
            >
              Reintentar
            </button>
          </div>
        ) : kindTab === "empty" ? (
          snapshot?.emptyRows.length ? (
            <div className="space-y-3">
              {snapshot.emptyRows.map((row) => (
                <EmptyRowCard key={row.itemId} row={row} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-[#111827] text-slate-500">
                <Boxes className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-4 text-base font-black text-[#f8fafc]">
                Sin cajas vacías rastreadas
              </p>
              <p className="mt-1 max-w-xs text-sm font-bold text-slate-500">
                Cuando haya stock en bodega, camión o agencias, aparecerá aquí.
              </p>
            </div>
          )
        ) : snapshot?.fullTotal ? (
          <FullBucketList buckets={snapshot.fullBuckets} />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-[#111827] text-slate-500">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-base font-black text-[#f8fafc]">
              Sin cajas llenas en flujo
            </p>
            <p className="mt-1 max-w-xs text-sm font-bold text-slate-500">
              Las cajas con código aparecen al recolectarlas o ingresarlas a bodega.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function InventoryTrackingDrawer({
  warehouseId,
  warehouseName,
  assignments,
  movements,
  initialItemId = null,
  initialTab = "custody",
  onAssignmentsChange,
  onMovementsChange,
  onCloseAssignment,
  closingAssignmentId = "",
  controlledOpen,
  onControlledOpenChange,
}: {
  warehouseId: string;
  warehouseName?: string;
  assignments: InventoryAssignment[];
  movements: InventoryMovement[];
  initialItemId?: string | null;
  initialTab?: InventoryTrackingTab;
  onAssignmentsChange: (next: InventoryAssignment[]) => void;
  onMovementsChange: (next: InventoryMovement[]) => void;
  onCloseAssignment: (assignmentId: string, input: CloseAssignmentSubmit) => Promise<boolean>;
  closingAssignmentId?: string;
  controlledOpen: boolean;
  onControlledOpenChange: (open: boolean) => void;
}) {
  const open = controlledOpen;
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<InventoryTrackingTab>(initialTab);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      setTab(initialItemId ? "assignments" : initialTab);
    });
  }, [open, initialItemId, initialTab]);

  const onClose = useCallback(() => {
    onControlledOpenChange(false);
  }, [onControlledOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar seguimiento"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col border-l border-black bg-[#1a2320] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal
        aria-labelledby="inventory-tracking-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/70 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Inventario
            </p>
            <h2
              id="inventory-tracking-title"
              className="flex items-center gap-2 text-lg font-black text-[#f8fafc]"
            >
              <LocateFixed className="h-5 w-5 text-emerald-400" aria-hidden />
              Seguimiento
            </h2>
            <p className="mt-0.5 truncate text-sm font-bold text-slate-400">
              {warehouseName || "Bodega"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-400 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="shrink-0 border-b border-black/70 px-4 py-3">
          <AppTabs
            tabs={trackingTabs.map((entry) => {
              if (entry.id === "assignments") {
                return { ...entry, badge: assignments.length || undefined };
              }
              if (entry.id === "history") {
                return { ...entry, badge: movements.length || undefined };
              }
              return entry;
            })}
            value={tab}
            onChange={setTab}
            size="compact"
            ariaLabel="Vistas de seguimiento"
          />
        </div>

        {tab === "custody" ? (
          <CustodyPanel
            active={open && tab === "custody"}
            warehouseId={warehouseId}
            warehouseName={warehouseName}
          />
        ) : null}

        {tab === "assignments" ? (
          <InventoryAssignmentsPanelBody
            active={open && tab === "assignments"}
            warehouseId={warehouseId}
            assignments={assignments}
            initialItemId={initialItemId}
            onAssignmentsChange={onAssignmentsChange}
            onCloseAssignment={onCloseAssignment}
            closingAssignmentId={closingAssignmentId}
          />
        ) : null}

        {tab === "history" ? (
          <InventoryMovementsSidePanel
            open={open && tab === "history"}
            onClose={onClose}
            warehouseId={warehouseId}
            movements={movements}
            assignments={assignments}
            warehouseName={warehouseName}
            onMovementsChange={onMovementsChange}
            embedded
          />
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
