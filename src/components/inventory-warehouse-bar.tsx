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
  if (!warehouses.length) {
    return null;
  }

  if (warehouses.length === 1) {
    return null;
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
