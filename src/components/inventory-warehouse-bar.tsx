"use client";

import { inputClass } from "@/components/ui-blocks";

type InventoryWarehouseBarProps = {
  warehouses: { id: string; name: string }[];
  warehouseId: string;
  multiWarehouse: boolean;
  onChange: (warehouseId: string) => void;
};

export function InventoryWarehouseBar({
  warehouses,
  warehouseId,
  multiWarehouse,
  onChange,
}: InventoryWarehouseBarProps) {
  if (!multiWarehouse && warehouses.length <= 1) {
    const warehouse = warehouses[0];

    return warehouse ? (
      <p className="mb-4 text-sm font-bold text-slate-400">Bodega: {warehouse.name}</p>
    ) : null;
  }

  return (
    <label className="mb-4 grid max-w-sm gap-2">
      <span className="text-xs font-black uppercase text-slate-400">Bodega activa</span>
      <select
        className={inputClass}
        value={warehouseId}
        onChange={(event) => onChange(event.target.value)}
      >
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
    </label>
  );
}
