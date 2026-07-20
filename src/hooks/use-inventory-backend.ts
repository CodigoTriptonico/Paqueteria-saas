"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadWarehouseInventoryCoreAction,
  loadWarehouseInventoryHistoryAction,
  saveWarehouseInventoryAction,
} from "@/app/actions/inventory";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { getCurrentSessionAction } from "@/app/actions/session";
import type { InventoryAssignment, InventoryMovement } from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import { mergeOrphanItemsIntoCategoryConfigs } from "@/lib/inventory-stock";
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

function snapshotInventory(
  warehouseId: string,
  categoryConfigs: CategoryConfig[],
  items: InventoryStockItem[],
) {
  return JSON.stringify({ warehouseId, categoryConfigs, items });
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
  const lastLoadedWarehouse = useRef(initialData?.warehouseId || "");
  const initialHistoryLoadedRef = useRef(
    Boolean(initialData?.movements.length || initialData?.assignments.length),
  );
  const lastSavedInventoryRef = useRef(
    initialData
      ? snapshotInventory(
          initialData.warehouseId,
          initialData.categoryConfigs,
          initialData.items,
        )
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
  }, []);

  const persistInventory = useCallback(
    async (
      targetWarehouseId: string,
      configs: CategoryConfig[],
      items: InventoryStockItem[],
    ) => {
      const syncedConfigs = mergeOrphanItemsIntoCategoryConfigs(configs, items);

      if (syncedConfigs !== configs) {
        categoryConfigsRef.current = syncedConfigs;
        setCategoryConfigs(syncedConfigs);
      }

      const snapshot = snapshotInventory(targetWarehouseId, syncedConfigs, items);
      const result = await saveWarehouseInventoryAction({
        warehouseId: targetWarehouseId,
        categoryConfigs: syncedConfigs,
        items,
      });

      if (!result.ok) {
        setError(result.error);
        return false;
      }

      if (warehouseIdRef.current === targetWarehouseId) {
        lastSavedInventoryRef.current = snapshot;
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
        const stockTarget = stockWarehouseId ?? warehouseIdRef.current;

        if (!stockTarget) {
          return;
        }

        const inventorySnapshot = snapshotInventory(
          stockTarget,
          categoryConfigsRef.current,
          inventoryItemsRef.current,
        );

        if (inventorySnapshot === lastSavedInventoryRef.current) {
          return;
        }

        await persistInventory(
          stockTarget,
          categoryConfigsRef.current,
          inventoryItemsRef.current,
        );
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
    [clearSaveTimers, persistInventory],
  );

  const persistCategoryConfigs = useCallback(
    async (nextCategoryConfigs: CategoryConfig[]) => {
      categoryConfigsRef.current = nextCategoryConfigs;
      setCategoryConfigs(nextCategoryConfigs);
      await flushSaves();
    },
    [flushSaves],
  );

  const loadRemote = useCallback(async (targetWarehouseId: string) => {
    const coreResult = await loadWarehouseInventoryCoreAction(targetWarehouseId);

    if (!coreResult.ok) {
      setError(coreResult.error);
      setLoaded(true);
      inventoryHydratedRef.current = false;
      return;
    }

    lastSavedInventoryRef.current = snapshotInventory(
      targetWarehouseId,
      coreResult.data.categoryConfigs,
      coreResult.data.items,
    );
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

    if (inventoryItems.length === 0 && categoryConfigs.length === 0) {
      return;
    }

    if (!warehouseId) {
      return;
    }

    const inventorySnapshot = snapshotInventory(
      warehouseId,
      categoryConfigs,
      inventoryItems,
    );

    if (inventorySnapshot === lastSavedInventoryRef.current) {
      return;
    }

    if (categorySaveTimer.current) {
      clearTimeout(categorySaveTimer.current);
    }

    const targetWarehouseId = warehouseId;

    categorySaveTimer.current = setTimeout(() => {
      categorySaveTimer.current = null;

      if (warehouseIdRef.current !== targetWarehouseId) {
        return;
      }

      void persistInventory(
        targetWarehouseId,
        categoryConfigsRef.current,
        inventoryItemsRef.current,
      );
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (categorySaveTimer.current) {
        clearTimeout(categorySaveTimer.current);
        categorySaveTimer.current = null;
      }
    };
  }, [categoryConfigs, enabled, inventoryItems, loaded, persistInventory, warehouseId]);

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
    persistCategoryConfigs,
    inventoryItems,
    setInventoryItems,
    movements,
    setMovements,
    assignments,
    setAssignments,
  };
}
