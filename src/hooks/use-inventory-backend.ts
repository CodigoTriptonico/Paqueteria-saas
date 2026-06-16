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
import type { CategoryConfig } from "@/lib/inventory-tree";
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

type InventorySavePayload = {
  warehouseId: string;
  categoryConfigs: CategoryConfig[];
  items: InventoryStockItem[];
};

function snapshotInventoryPayload(payload: InventorySavePayload) {
  return JSON.stringify(payload);
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
  const inventoryHydratedRef = useRef(
    Boolean(
      initialData?.warehouseId &&
        (initialData.categoryConfigs.length > 0 || initialData.items.length > 0),
    ),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedWarehouse = useRef(initialData?.warehouseId || "");
  const initialHistoryLoadedRef = useRef(
    Boolean(initialData?.movements.length || initialData?.assignments.length),
  );
  const lastSavedSnapshotRef = useRef(
    initialData
      ? snapshotInventoryPayload({
          warehouseId: initialData.warehouseId,
          categoryConfigs: initialData.categoryConfigs,
          items: initialData.items,
        })
      : "",
  );

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active),
    [warehouses],
  );

  const loadRemote = useCallback(async (targetWarehouseId: string) => {
    const coreResult = await loadWarehouseInventoryCoreAction(targetWarehouseId);

    if (!coreResult.ok) {
      setError(coreResult.error);
      setLoaded(true);
      inventoryHydratedRef.current = false;
      return;
    }

    const payload = {
      warehouseId: targetWarehouseId,
      categoryConfigs: coreResult.data.categoryConfigs,
      items: coreResult.data.items,
    };

    lastSavedSnapshotRef.current = snapshotInventoryPayload(payload);
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

    queueMicrotask(() => {
      void loadRemote(warehouseId);
    });
  }, [enabled, warehouseId, loadRemote]);

  useEffect(() => {
    if (!enabled || !loaded || !warehouseId || !inventoryHydratedRef.current) {
      return;
    }

    if (categoryConfigs.length === 0 && inventoryItems.length === 0) {
      return;
    }

    const payload = {
      warehouseId,
      categoryConfigs,
      items: inventoryItems,
    };
    const snapshot = snapshotInventoryPayload(payload);

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void saveWarehouseInventoryAction(payload).then((result) => {
        if (result.ok) {
          lastSavedSnapshotRef.current = snapshot;
        }
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
