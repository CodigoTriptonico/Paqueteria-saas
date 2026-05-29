"use client";

import { useEffect } from "react";
import { InventoryMovementsPanel } from "@/components/inventory-movements-panel";
import { InventoryStructureEditor } from "@/components/inventory-structure-editor";
import { InventoryWarehouseBar } from "@/components/inventory-warehouse-bar";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { useInventoryBackend } from "@/hooks/use-inventory-backend";
import { mergeTreeIntoInventoryItems } from "@/lib/inventory-stock";

export function InventarioClient() {
  const {
    enabled,
    loaded,
    error,
    multiWarehouse,
    warehouses,
    warehouseId,
    setWarehouseId,
    categoryConfigs,
    setCategoryConfigs,
    inventoryItems,
    setInventoryItems,
    movements,
  } = useInventoryBackend();

  const activeWarehouseName =
    warehouses.find((warehouse) => warehouse.id === warehouseId)?.name || "";

  useEffect(() => {
    if (!loaded || !categoryConfigs.length) {
      return;
    }

    queueMicrotask(() => {
      setInventoryItems((current) => mergeTreeIntoInventoryItems(categoryConfigs, current));
    });
  }, [categoryConfigs, loaded, setInventoryItems]);

  if (!loaded) {
    return null;
  }

  if (!enabled) {
    return (
      <SupabaseRequiredBanner detail="El inventario (categorías, stock y movimientos) se lee y guarda en Supabase por bodega." />
    );
  }

  return (
    <>
      <InventoryWarehouseBar
        warehouses={warehouses}
        warehouseId={warehouseId}
        multiWarehouse={multiWarehouse}
        onChange={setWarehouseId}
      />

      {error ? (
        <p className="mb-4 rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm font-bold text-amber-100">
          {error}
        </p>
      ) : null}

      {!warehouses.length ? (
        <p className="mb-4 rounded-lg border border-black bg-surface-card px-4 py-3 text-sm font-bold text-slate-300">
          No hay bodegas activas. Crea una en Configuración → Inventario → Bodegas.
        </p>
      ) : null}

      <InventoryStructureEditor
        categoryConfigs={categoryConfigs}
        onCategoryConfigsChange={setCategoryConfigs}
        inventoryItems={inventoryItems}
        onInventoryItemsChange={setInventoryItems}
      />

      <InventoryMovementsPanel movements={movements} warehouseName={activeWarehouseName} />
    </>
  );
}
