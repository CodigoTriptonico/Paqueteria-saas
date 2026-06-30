"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadWarehouseInventoryCoreAction,
  loadWarehouseInventoryHistoryAction,
  saveInventoryCategoriesAction,
  saveWarehouseStockAction,
} from "@/app/actions/inventory";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { getCurrentSessionAction } from "@/app/actions/session";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { CategoryConfig } from "@/lib/inventory-tree";
import { dispatchOnboardingProgressChanged } from "@/lib/onboarding/refresh";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sessionHasPermission } from "@/lib/auth/permissions";

export type InventoryBackendInitialData = {
  warehouses: { id: string; name: string; is_active: boolean; is_default: boolean }[];
  warehouseId: string;
  multiWarehouse: boolean;
  canManageWarehouses?: boolean;
  categoryConfigs: CategoryConfig[];
  items: InventoryStockItem[];
  movements: InventoryMovement[];
  assignments: InventoryAssignment[];
};

const SAVE_DEBOUNCE_MS = 600;

function snapshotCategories(categoryConfigs: CategoryConfig[]) {
  return JSON.stringify(categoryConfigs);
}

function snapshotStock(warehouseId: string, items: InventoryStockItem[]) {
  return JSON.stringify({ warehouseId, items });
}

export function useInventoryBackend(initialData?: InventoryBackendInitialData) {
  const enabled = isSupabaseConfigured();
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; is_active: boolean; is_default: boolean }[]
  >(initialData?.warehouses || []);
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || "");
  const [multiWarehouse, setMultiWarehouse] = useState(Boolean(initialData?.multiWarehouse));
  const [canManageWarehouses, setCanManageWarehouses] = useState(
    Boolean(initialData?.canManageWarehouses),
  );
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>(
    initialData?.categoryConfigs || [],
  );
  const [inventoryItems, setInventoryItems] = useState<InventoryStockItem[]>(
    initialData?.items || [],
  );
  const [movements, setMovements] = useState<InventoryMovement[]>(initialData?.movements || []);
  const [assignments, setAssignments] = useState<InventoryAssignment[]>(
    initialData?.assignments || [],
  );
  const [loaded, setLoaded] = useState(!enabled || Boolean(initialData));
  const [error, setError] = useState("");
  const inventoryHydratedRef = useRef(Boolean(initialData?.warehouseId));
  const categorySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stockSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedWarehouse = useRef(initialData?.warehouseId || "");
  const initialHistoryLoadedRef = useRef(
    Boolean(initialData?.movements.length || initialData?.assignments.length),
  );
  const lastSavedCategoriesRef = useRef(
    snapshotCategories(initialData?.categoryConfigs || []),
  );
  const lastSavedStockRef = useRef(
    initialData
      ? snapshotStock(initialData.warehouseId, initialData.items)
      : "",
  );
  const categoryConfigsRef = useRef(categoryConfigs);
  const inventoryItemsRef = useRef(inventoryItems);
  const warehouseIdRef = useRef(warehouseId);
  const inflightSaveRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    categoryConfigsRef.current = categoryConfigs;
    inventoryItemsRef.current = inventoryItems;
    warehouseIdRef.current = warehouseId;
  }, [categoryConfigs, inventoryItems, warehouseId]);

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active),
    [warehouses],
  );

  const clearSaveTimers = useCallback(() => {
    if (categorySaveTimer.current) {
      clearTimeout(categorySaveTimer.current);
      categorySaveTimer.current = null;
    }

    if (stockSaveTimer.current) {
      clearTimeout(stockSaveTimer.current);
      stockSaveTimer.current = null;
    }
  }, []);

  const persistCategories = useCallback(async (configs: CategoryConfig[]) => {
    const snapshot = snapshotCategories(configs);
    const result = await saveInventoryCategoriesAction(configs);

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    lastSavedCategoriesRef.current = snapshot;
    dispatchOnboardingProgressChanged();
    return true;
  }, []);

  const persistStock = useCallback(
    async (targetWarehouseId: string, items: InventoryStockItem[]) => {
      const snapshot = snapshotStock(targetWarehouseId, items);
      const result = await saveWarehouseStockAction({
        warehouseId: targetWarehouseId,
        categoryConfigs: categoryConfigsRef.current,
        items,
      });

      if (!result.ok) {
        setError(result.error);
        return false;
      }

      if (warehouseIdRef.current === targetWarehouseId) {
        lastSavedStockRef.current = snapshot;
      }

      dispatchOnboardingProgressChanged();
      return true;
    },
    [],
  );

  const flushSaves = useCallback(
    async (stockWarehouseId?: string) => {
      clearSaveTimers();

      const run = async () => {
        const categoriesSnapshot = snapshotCategories(categoryConfigsRef.current);
        const stockTarget = stockWarehouseId ?? warehouseIdRef.current;

        if (
          categoriesSnapshot !== lastSavedCategoriesRef.current &&
          categoryConfigsRef.current.length > 0
        ) {
          await persistCategories(categoryConfigsRef.current);
        }

        if (stockTarget) {
          const stockSnapshot = snapshotStock(stockTarget, inventoryItemsRef.current);

          if (stockSnapshot !== lastSavedStockRef.current) {
            await persistStock(stockTarget, inventoryItemsRef.current);
          }
        }
      };

      const pending = inflightSaveRef.current
        ? inflightSaveRef.current.then(() => run())
        : run();

      inflightSaveRef.current = pending.finally(() => {
        if (inflightSaveRef.current === pending) {
          inflightSaveRef.current = null;
        }
      });

      await pending;
    },
    [clearSaveTimers, persistCategories, persistStock],
  );

  const loadRemote = useCallback(async (targetWarehouseId: string) => {
    const coreResult = await loadWarehouseInventoryCoreAction(targetWarehouseId);

    if (!coreResult.ok) {
      setError(coreResult.error);
      setLoaded(true);
      inventoryHydratedRef.current = false;
      return;
    }

    lastSavedCategoriesRef.current = snapshotCategories(coreResult.data.categoryConfigs);
    lastSavedStockRef.current = snapshotStock(targetWarehouseId, coreResult.data.items);
    setCategoryConfigs(coreResult.data.categoryConfigs);
    setInventoryItems(coreResult.data.items);
    lastLoadedWarehouse.current = targetWarehouseId;
    inventoryHydratedRef.current = true;
    setLoaded(true);

    void loadWarehouseInventoryHistoryAction(targetWarehouseId).then((historyResult) => {
      if (!historyResult.ok) {
        setError(historyResult.error);
        return;
      }

      setMovements(historyResult.data.movements);
      setAssignments(historyResult.data.assignments);
    });
  }, []);

  useEffect(() => {
    if (
      !enabled ||
      !warehouseId ||
      initialHistoryLoadedRef.current ||
      !initialData?.warehouseId
    ) {
      return;
    }

    initialHistoryLoadedRef.current = true;

    void loadWarehouseInventoryHistoryAction(warehouseId).then((result) => {
      if (!result.ok) {
        return;
      }

      setMovements(result.data.movements);
      setAssignments(result.data.assignments);
    });
  }, [enabled, initialData?.warehouseId, warehouseId]);

  useEffect(() => {
    if (!enabled || initialData) {
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

      const session = sessionResult.ok ? sessionResult.data : null;

      if (session) {
        setMultiWarehouse(session.multiWarehouseEnabled);
        setCanManageWarehouses(
          sessionHasPermission(session, "warehouses.manage"),
        );
      }

      const defaultWarehouse =
        (session?.preferredWarehouseId &&
          active.find((warehouse) => warehouse.id === session.preferredWarehouseId)) ||
        active.find((warehouse) => warehouse.is_default) ||
        active[0] ||
        null;

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
  }, [enabled, initialData, loadRemote]);

  useEffect(() => {
    if (!enabled || !warehouseId || warehouseId === lastLoadedWarehouse.current) {
      return;
    }

    const previousWarehouse = lastLoadedWarehouse.current;

    queueMicrotask(() => {
      void (async () => {
        if (previousWarehouse) {
          await flushSaves(previousWarehouse);
        }

        await loadRemote(warehouseId);
      })();
    });
  }, [enabled, flushSaves, loadRemote, warehouseId]);

  useEffect(() => {
    if (!enabled || !loaded || !inventoryHydratedRef.current) {
      return;
    }

    if (categoryConfigs.length === 0) {
      return;
    }

    const categoriesSnapshot = snapshotCategories(categoryConfigs);

    if (categoriesSnapshot === lastSavedCategoriesRef.current) {
      return;
    }

    if (categorySaveTimer.current) {
      clearTimeout(categorySaveTimer.current);
    }

    categorySaveTimer.current = setTimeout(() => {
      categorySaveTimer.current = null;
      void persistCategories(categoryConfigsRef.current);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (categorySaveTimer.current) {
        clearTimeout(categorySaveTimer.current);
        categorySaveTimer.current = null;
      }
    };
  }, [categoryConfigs, enabled, loaded, persistCategories]);

  useEffect(() => {
    if (!enabled || !loaded || !warehouseId || !inventoryHydratedRef.current) {
      return;
    }

    if (inventoryItems.length === 0 && categoryConfigs.length === 0) {
      return;
    }

    const stockSnapshot = snapshotStock(warehouseId, inventoryItems);

    if (stockSnapshot === lastSavedStockRef.current) {
      return;
    }

    if (stockSaveTimer.current) {
      clearTimeout(stockSaveTimer.current);
    }

    const targetWarehouseId = warehouseId;

    stockSaveTimer.current = setTimeout(() => {
      stockSaveTimer.current = null;

      if (warehouseIdRef.current !== targetWarehouseId) {
        return;
      }

      void persistStock(targetWarehouseId, inventoryItemsRef.current);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (stockSaveTimer.current) {
        clearTimeout(stockSaveTimer.current);
        stockSaveTimer.current = null;
      }
    };
  }, [categoryConfigs.length, enabled, inventoryItems, loaded, persistStock, warehouseId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleBeforeUnload() {
      void flushSaves();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void flushSaves();
    };
  }, [enabled, flushSaves]);

  return {
    enabled,
    loaded,
    error,
    multiWarehouse,
    canManageWarehouses,
    warehouses: activeWarehouses,
    setWarehouses,
    warehouseId,
    setWarehouseId,
    categoryConfigs,
    setCategoryConfigs,
    inventoryItems,
    setInventoryItems,
    movements,
    setMovements,
    assignments,
    setAssignments,
  };
}
