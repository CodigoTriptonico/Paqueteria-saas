"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Loader2,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { listInventoryMovementsAction } from "@/app/actions/inventory-assignments";
import {
  listOrgMembersForInventoryAction,
  type InventoryMemberRow,
} from "@/app/actions/users";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import { inputClass } from "@/components/ui-blocks";
import type {
  InventoryAssignment,
  InventoryMovement,
  InventoryMovementType,
} from "@/lib/inventory-types";
import { summarizeMovements } from "@/lib/inventory-reports";

type InventoryMovementsDrawerProps = {
  warehouseId: string;
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
  warehouseName?: string;
  iconOnly?: boolean;
  onMovementsChange?: (next: InventoryMovement[]) => void;
};

const typeLabels: Record<InventoryMovementType, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  asignacion: "Asignación",
  devolucion: "Devolución",
  consumo: "Consumo",
  dano: "Daño",
  perdida: "Pérdida",
};

const typeTone: Record<InventoryMovementType, string> = {
  entrada: "border-emerald-500/30 bg-emerald-400/10 text-emerald-200",
  salida: "border-rose-500/30 bg-rose-400/10 text-rose-200",
  ajuste: "border-amber-500/30 bg-amber-400/10 text-amber-200",
  asignacion: "border-sky-500/30 bg-sky-400/10 text-sky-200",
  devolucion: "border-emerald-500/30 bg-emerald-400/10 text-emerald-200",
  consumo: "border-amber-500/30 bg-amber-400/10 text-amber-200",
  dano: "border-rose-500/30 bg-rose-400/10 text-rose-200",
  perdida: "border-rose-500/30 bg-rose-400/10 text-rose-200",
};

const TYPE_FILTER_OPTIONS = Object.entries(typeLabels).map(([value, label]) => ({
  value,
  label,
}));

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function MovementTypeIcon({ type }: { type: InventoryMovementType }) {
  if (type === "entrada" || type === "devolucion") {
    return <ArrowDownLeft className="h-4 w-4" aria-hidden />;
  }

  if (type === "salida" || type === "asignacion") {
    return <ArrowUpRight className="h-4 w-4" aria-hidden />;
  }

  return <SlidersHorizontal className="h-4 w-4" aria-hidden />;
}

export function MovementList({
  movements,
  warehouseName,
  emptyHint,
}: {
  movements: InventoryMovement[];
  warehouseName?: string;
  emptyHint?: string;
}) {
  if (!movements.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-[#111827] text-slate-500">
          <History className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-4 text-base font-black text-[#f8fafc]">Sin movimientos</p>
        <p className="mt-1 max-w-xs text-sm font-bold text-slate-500">
          {emptyHint ||
            (warehouseName
              ? `Los cambios de stock en ${warehouseName} aparecerán aquí.`
              : "Los cambios de stock aparecerán aquí.")}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 p-4">
      {movements.map((movement) => (
        <li key={movement.id} className="rounded-xl border border-black bg-[#111827] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#f8fafc]">
                {movement.itemName}
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                {formatWhen(movement.createdAt)}
              </p>
              {movement.assigneeName ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-sky-300">
                  <UserRound className="h-3 w-3" aria-hidden />
                  {movement.assigneeName}
                </p>
              ) : null}
              {movement.createdByName ? (
                <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                  Por {movement.createdByName}
                </p>
              ) : null}
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${typeTone[movement.type]}`}
            >
              <MovementTypeIcon type={movement.type} />
              {typeLabels[movement.type]}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/70 pt-2">
            <span className="text-xs font-bold text-slate-500">Cantidad</span>
            <span className="text-sm font-black tabular-nums text-[#f8fafc]">
              {movement.qty}
            </span>
          </div>
          {movement.note ? (
            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-400">
              {movement.note}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function MovementSummaryPanel({
  movements,
  assignments,
}: {
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
}) {
  const rows = useMemo(
    () => summarizeMovements(movements, assignments),
    [assignments, movements],
  );

  if (!rows.length) {
    return (
      <div className="px-4 py-10 text-center text-sm font-bold text-slate-500">
        Sin datos para el periodo filtrado.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {rows.map((row) => (
        <article
          key={`${row.assigneeId}-${row.itemId}`}
          className="rounded-xl border border-black bg-[#111827] p-3"
        >
          <p className="text-sm font-black text-[#f8fafc]">{row.assigneeName}</p>
          <p className="truncate text-xs font-bold text-slate-400">{row.itemName}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
            <span className="text-sky-300">Abierto: {row.openAssigned}</span>
            <span className="text-emerald-300">Devuelto: {row.returned}</span>
            <span className="text-amber-300">Consumido: {row.consumed}</span>
            <span className="text-rose-300">Daño: {row.damaged}</span>
            <span className="text-rose-300">Perdido: {row.lost}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

type InventoryMovementsSidePanelProps = {
  open: boolean;
  onClose: () => void;
  warehouseId: string;
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
  warehouseName?: string;
  title?: string;
  subtitle?: string;
  emptyHint?: string;
  titleId?: string;
  zIndexClass?: string;
  fixedItemId?: string;
  onMovementsChange?: (next: InventoryMovement[]) => void;
};

export function InventoryMovementsSidePanel({
  open,
  onClose,
  warehouseId,
  movements,
  assignments,
  warehouseName,
  title = "Historial de movimientos",
  subtitle,
  emptyHint,
  titleId = "inventory-movements-title",
  zIndexClass = "z-[130]",
  fixedItemId,
  onMovementsChange,
}: InventoryMovementsSidePanelProps) {
  const [tab, setTab] = useState<"history" | "summary">("history");
  const [members, setMembers] = useState<InventoryMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState(movements);
  const [assigneeId, setAssigneeId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setRows(movements);
    });
  }, [movements]);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      void listOrgMembersForInventoryAction().then((result) => {
        if (result.ok) {
          setMembers(result.data);
        }
      });
    });
  }, [open]);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.id,
        label: member.full_name || member.email,
      })),
    [members],
  );

  const itemOptions = useMemo(() => {
    const names = [...new Set(movements.map((row) => row.itemName))];
    return names.map((name) => ({ value: name, label: name }));
  }, [movements]);

  const reload = useCallback(async () => {
    if (!warehouseId) {
      return;
    }

    setLoading(true);
    const result = await listInventoryMovementsAction({
      warehouseId,
      itemId: fixedItemId,
      assigneeId: assigneeId || undefined,
      createdBy: createdBy || undefined,
      type: (typeFilter as InventoryMovementType) || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      limit: 100,
    });
    setLoading(false);

    if (result.ok) {
      let next = result.data;

      if (itemQuery.trim()) {
        const query = itemQuery.trim().toLowerCase();
        next = next.filter((row) => row.itemName.toLowerCase().includes(query));
      }

      setRows(next);
      onMovementsChange?.(next);
    }
  }, [
    assigneeId,
    createdBy,
    dateFrom,
    dateTo,
    fixedItemId,
    itemQuery,
    onMovementsChange,
    typeFilter,
    warehouseId,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      void reload();
    });
  }, [open, reload]);

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

  if (!open) {
    return null;
  }

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex justify-end`}>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Cerrar historial"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col border-l border-black bg-[#1a2320] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/70 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Inventario
            </p>
            <h2 id={titleId} className="text-lg font-black text-[#f8fafc]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm font-bold text-slate-400">{subtitle}</p>
            ) : warehouseName ? (
              <p className="mt-0.5 truncate text-sm font-bold text-slate-400">
                {warehouseName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300 hover:text-[#f8fafc]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex shrink-0 gap-4 border-b border-black/70 px-4">
          <button
            type="button"
            className={`border-b-2 pb-2.5 text-sm font-black ${
              tab === "history"
                ? "border-emerald-400 text-[#f8fafc]"
                : "border-transparent text-slate-400"
            }`}
            onClick={() => setTab("history")}
          >
            Historial
          </button>
          <button
            type="button"
            className={`border-b-2 pb-2.5 text-sm font-black ${
              tab === "summary"
                ? "border-emerald-400 text-[#f8fafc]"
                : "border-transparent text-slate-400"
            }`}
            onClick={() => setTab("summary")}
          >
            Resumen
          </button>
        </div>

        {tab === "history" ? (
          <div className="shrink-0 space-y-2 border-b border-black/70 p-4">
            <InlineSearchCombobox
              value={itemQuery}
              onChange={setItemQuery}
              options={itemOptions}
              placeholder="Item"
              emptyLabel="Sin items"
              ariaLabel="Filtrar item"
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => setItemQuery(option.label)}
            />
            <InlineSearchPicker
              value={assigneeId}
              onChange={setAssigneeId}
              options={[{ value: "", label: "Empleado (todos)" }, ...memberOptions]}
              placeholder="Empleado"
              searchPlaceholder="Buscar…"
              ariaLabel="Filtrar empleado"
              className="w-full"
              minWidthClass="w-full min-w-0"
            />
            <InlineSearchPicker
              value={createdBy}
              onChange={setCreatedBy}
              options={[{ value: "", label: "Responsable (todos)" }, ...memberOptions]}
              placeholder="Responsable"
              searchPlaceholder="Buscar…"
              ariaLabel="Filtrar responsable"
              className="w-full"
              minWidthClass="w-full min-w-0"
            />
            <InlineSearchPicker
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: "", label: "Tipo (todos)" }, ...TYPE_FILTER_OPTIONS]}
              placeholder="Tipo"
              searchPlaceholder="Buscar…"
              ariaLabel="Filtrar tipo"
              className="w-full"
              minWidthClass="w-full min-w-0"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-black uppercase text-slate-400">
                Desde
                <input
                  type="date"
                  className={`${inputClass} h-9 text-sm`}
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-[11px] font-black uppercase text-slate-400">
                Hasta
                <input
                  type="date"
                  className={`${inputClass} h-9 text-sm`}
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-black bg-emerald-400/10 text-sm font-black text-emerald-200"
            >
              Aplicar filtros
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : tab === "summary" ? (
            <MovementSummaryPanel movements={rows} assignments={assignments} />
          ) : (
            <MovementList
              movements={rows}
              warehouseName={warehouseName}
              emptyHint={emptyHint}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

export function InventoryMovementsDrawer({
  warehouseId,
  movements,
  assignments,
  warehouseName,
  iconOnly = false,
  onMovementsChange,
}: InventoryMovementsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  const drawer = mounted ? (
    <InventoryMovementsSidePanel
      open={open}
      onClose={close}
      warehouseId={warehouseId}
      movements={movements}
      assignments={assignments}
      warehouseName={warehouseName}
      onMovementsChange={onMovementsChange}
    />
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          iconOnly
            ? "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300 transition hover:text-[#f8fafc]"
            : "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-black bg-[#111827] px-3 text-xs font-black text-slate-300 transition hover:text-[#f8fafc]"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Historial de movimientos"
        aria-label="Historial de movimientos"
      >
        <History className="h-4 w-4 text-slate-400" aria-hidden />
        {iconOnly ? null : (
          <>
            <span className="hidden sm:inline">Historial</span>
            {movements.length ? (
              <span className="rounded-md border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-400">
                {movements.length}
              </span>
            ) : null}
          </>
        )}
        {iconOnly && movements.length ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black bg-surface-inset px-1 text-[9px] font-black tabular-nums text-slate-300">
            {movements.length}
          </span>
        ) : null}
      </button>
      {drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
