"use client";

import { Check, Shield, Star, Warehouse } from "lucide-react";
import { CompactInfoDisclosure } from "@/components/ui-blocks";

type WarehouseAccessOption = {
  id: string;
  name: string;
  is_default?: boolean;
};

type UserWarehouseAccessEditorProps = {
  warehouses: WarehouseAccessOption[];
  selectedIds: string[];
  preferredId: string | null;
  isAdmin: boolean;
  disabled?: boolean;
  onSelectedChange: (ids: string[]) => void;
  onPreferredChange: (id: string | null) => void;
};

export function UserWarehouseAccessEditor({
  warehouses,
  selectedIds,
  preferredId,
  isAdmin,
  disabled,
  onSelectedChange,
  onPreferredChange,
}: UserWarehouseAccessEditorProps) {
  if (!warehouses.length) {
    return (
      <p className="text-xs font-bold text-slate-500">
        No hay bodegas activas en la organización.
      </p>
    );
  }

  if (isAdmin) {
    return (
      <div className="grid gap-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-900/50 bg-sky-950/35 px-3 py-2.5">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <p className="text-xs font-bold leading-relaxed text-sky-100/90">
            El administrador accede a todas las bodegas activas. No necesita asignación
            manual.
          </p>
        </div>
        <ul className="grid gap-1.5">
          {warehouses.map((warehouse) => (
            <li
              key={warehouse.id}
              className="flex items-center gap-2.5 rounded-lg border border-black bg-surface-inset px-3 py-2.5"
            >
              <Warehouse className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-200">
                {warehouse.name}
              </span>
              {warehouse.is_default ? (
                <span className="shrink-0 rounded-md border border-emerald-700/40 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-200">
                  Org.
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function toggleWarehouse(warehouseId: string) {
    if (disabled) {
      return;
    }

    const checked = selectedIds.includes(warehouseId);

    if (checked) {
      const next = selectedIds.filter((id) => id !== warehouseId);
      onSelectedChange(next);

      if (preferredId === warehouseId) {
        onPreferredChange(next.length === 1 ? next[0] : null);
      }

      return;
    }

    const next = [...selectedIds, warehouseId];
    onSelectedChange(next);

    if (next.length === 1) {
      onPreferredChange(next[0]);
    }
  }

  function togglePreferred(warehouseId: string) {
    if (disabled || !selectedIds.includes(warehouseId)) {
      return;
    }

    onPreferredChange(preferredId === warehouseId ? null : warehouseId);
  }

  const showFavoriteHint = selectedIds.length > 1 && !preferredId;

  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5">
        {warehouses.map((warehouse) => {
          const checked = selectedIds.includes(warehouse.id);
          const isPreferred = preferredId === warehouse.id;

          return (
            <li
              key={warehouse.id}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                checked
                  ? "border-emerald-800/60 bg-emerald-950/30"
                  : "border-black bg-surface-inset"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleWarehouse(warehouse.id)}
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition ${
                  disabled ? "cursor-not-allowed" : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? "border-emerald-500 bg-emerald-400 text-slate-950"
                      : "border-slate-600 bg-surface-panel"
                  }`}
                >
                  {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <Warehouse
                  className={`h-4 w-4 shrink-0 ${checked ? "text-emerald-300" : "text-slate-500"}`}
                  aria-hidden
                />
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-black ${
                    checked ? "text-[#f8fafc]" : "text-slate-400"
                  }`}
                >
                  {warehouse.name}
                </span>
                {warehouse.is_default ? (
                  <span className="shrink-0 rounded-md border border-slate-700 bg-surface-panel px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">
                    Org.
                  </span>
                ) : null}
              </button>

              {checked && selectedIds.length > 1 ? (
                <button
                  type="button"
                  disabled={disabled}
                  title={isPreferred ? "Bodega favorita" : "Marcar como favorita"}
                  aria-label={
                    isPreferred
                      ? `${warehouse.name} es la bodega favorita`
                      : `Marcar ${warehouse.name} como favorita`
                  }
                  onClick={() => togglePreferred(warehouse.id)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
                    isPreferred
                      ? "border-amber-500/60 bg-amber-400/15 text-amber-200"
                      : "border-black bg-surface-panel text-slate-500 hover:text-amber-200"
                  }`}
                >
                  <Star
                    className={`h-4 w-4 ${isPreferred ? "fill-current" : ""}`}
                    aria-hidden
                  />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {selectedIds.length === 0 ? (
        <p className="text-xs font-bold text-amber-200/90">
          Sin bodegas marcadas, el usuario no podrá operar inventario.
        </p>
      ) : showFavoriteHint ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-400">Bodega favorita</span>
          <CompactInfoDisclosure ariaLabel="Cómo elegir la bodega favorita">
            Toca la estrella para elegir la bodega favorita. Inventario abrirá allí.
          </CompactInfoDisclosure>
        </div>
      ) : preferredId ? (
        <p className="text-xs font-bold text-slate-500">
          Favorita:{" "}
          <span className="text-amber-200">
            {warehouses.find((warehouse) => warehouse.id === preferredId)?.name}
          </span>
        </p>
      ) : null}
    </div>
  );
}
