"use client";

import { Warehouse } from "lucide-react";
import { InlineSearchPicker } from "@/components/inline-search-picker";

type WarehouseOption = {
  id: string;
  name: string;
  is_default?: boolean;
};

type InventoryWarehouseBarProps = {
  warehouses: WarehouseOption[];
  warehouseId: string;
  onChange: (warehouseId: string) => void;
  compact?: boolean;
};

function warehouseDisplayName(warehouse: WarehouseOption) {
  return warehouse.is_default ? `${warehouse.name} (principal)` : warehouse.name;
}

export function InventoryWarehouseBar({
  warehouses,
  warehouseId,
  onChange,
  compact = false,
}: InventoryWarehouseBarProps) {
  const activeWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);

  if (!warehouses.length) {
    return null;
  }

  if (warehouses.length === 1 && activeWarehouse) {
    if (!compact) {
      return null;
    }

    return (
      <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-black bg-[#111827] px-3 text-sm font-black text-slate-200">
        <Warehouse className="h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
        <span className="truncate">{activeWarehouse.name}</span>
        {activeWarehouse.is_default ? (
          <span className="shrink-0 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-300">
            Org.
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <InlineSearchPicker
      compact={compact}
      value={warehouseId}
      onChange={onChange}
      placeholder="Elegir bodega"
      searchPlaceholder="Buscar bodega…"
      emptyLabel="Sin coincidencias"
      ariaLabel="Bodega activa"
      leadingIcon={<Warehouse className="h-4 w-4" aria-hidden />}
      options={warehouses.map((warehouse) => ({
        value: warehouse.id,
        label: warehouseDisplayName(warehouse),
        searchText: warehouse.name,
        icon: (
          <Warehouse
            className={`h-4 w-4 ${warehouse.id === warehouseId ? "text-emerald-300" : "text-slate-500"}`}
            aria-hidden
          />
        ),
      }))}
    />
  );
}
