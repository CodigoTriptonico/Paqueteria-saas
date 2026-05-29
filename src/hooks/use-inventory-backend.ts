"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadWarehouseInventoryAction, saveWarehouseInventoryAction } from "@/app/actions/inventory";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { getCurrentSessionAction } from "@/app/actions/session";
import type { InventoryMovement } from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { CategoryConfig } from "@/lib/inventory-tree";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function useInventoryBackend() {
  const enabled = isSupabaseConfigured();
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; is_active: boolean; is_default: boolean }[]
  >([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [multiWarehouse, setMultiWarehouse] = useState(false);
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryStockItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loaded, setLoaded] = useState(!enabled);
  const [error, setError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active),
    [warehouses],
  );

  const loadRemote = useCallback(async (targetWarehouseId: string) => {
    const result = await loadWarehouseInventoryAction(targetWarehouseId);

    if (!result.ok) {
      setError(result.error);
      setLoaded(true);
      return;
    }

    setCategoryConfigs(result.data.categoryConfigs);
    setInventoryItems(result.data.items);
    setMovements(result.data.movements);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    async function bootstrap() {
      const [sessionResult, warehousesResult] = await Promise.all([
        getCurrentSessionAction(),
        listWarehousesAction(),
      ]);

      if (!warehousesResult.ok) {
        setError(warehousesResult.error);
        setLoaded(true);
        return;
      }

      const active = warehousesResult.data.filter((warehouse) => warehouse.is_active);
      setWarehouses(active);

      if (sessionResult.ok && sessionResult.data) {
        setMultiWarehouse(sessionResult.data.multiWarehouseEnabled);
      }

      const defaultWarehouse =
        active.find((warehouse) => warehouse.is_default) || active[0] || null;

      if (!defaultWarehouse) {
        setLoaded(true);
        return;
      }

      setWarehouseId(defaultWarehouse.id);
      await loadRemote(defaultWarehouse.id);
    }

    queueMicrotask(() => {
      void bootstrap();
    });
  }, [enabled, loadRemote]);

  useEffect(() => {
    if (!enabled || !warehouseId) {
      return;
    }

    queueMicrotask(() => {
      void loadRemote(warehouseId);
    });
  }, [enabled, warehouseId, loadRemote]);

  useEffect(() => {
    if (!enabled || !loaded || !warehouseId) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void saveWarehouseInventoryAction({
        warehouseId,
        categoryConfigs,
        items: inventoryItems,
      });
    }, 600);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [categoryConfigs, enabled, inventoryItems, loaded, warehouseId]);

  return {
    enabled,
    loaded,
    error,
    multiWarehouse,
    warehouses: activeWarehouses,
    warehouseId,
    setWarehouseId,
    categoryConfigs,
    setCategoryConfigs,
    inventoryItems,
    setInventoryItems,
    movements,
    setMovements,
  };
}
