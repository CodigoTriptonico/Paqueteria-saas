"use client";

import { Plus, Warehouse } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWarehouseAction } from "@/app/actions/warehouses";
import {
  assignInventoryItemAction,
  closeInventoryAssignmentAction,
  ensureInventoryItemForLeafAction,
} from "@/app/actions/inventory-assignments";
import {
  AssignInventoryModal,
  type CloseAssignmentSubmit,
} from "@/components/inventory-assignment-modals";
import { InventoryControlMenu } from "@/components/inventory/inventory-control-menu";
import { InventoryTruckPanel } from "@/components/inventory/inventory-truck-panel";
import { InventoryStructureEditor } from "@/components/inventory-structure-editor";
import { InventoryWarehouseBar } from "@/components/inventory-warehouse-bar";
import { WarehousesSettingsPanel } from "@/components/config/warehouses-settings-panel";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { useContextNav } from "@/hooks/use-context-nav";
import { useNotify } from "@/hooks/use-notify";
import {
  useInventoryBackend,
  type InventoryBackendInitialData,
} from "@/hooks/use-inventory-backend";
import { ProductCountriesModal } from "@/components/product-countries-modal";
import { usePricingBackend } from "@/hooks/use-pricing-backend";
import {
  catalogProductFromLeaf,
  type InventoryCatalogProduct,
} from "@/lib/pricing-catalog";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";
import { mergeTreeIntoInventoryItems } from "@/lib/inventory-stock";
import type { PricingConfigPayload } from "@/lib/pricing/types";
import {
  inventarioReturnActionLabel,
  readInventarioReturnTo,
} from "@/lib/inventario-return";
import { INVENTORY_WAREHOUSES_HREF } from "@/lib/inventory-structure-utils";
import { ONBOARDING_TARGETS } from "@/lib/onboarding/coach-targets";

type AssignDraft = {
  itemName: string;
  maxQty: number;
  resolveItemId: () => Promise<string | null>;
};

export function InventarioClient({
  initialData,
  initialPricing,
  initialTruckBalances = [],
}: {
  initialData?: InventoryBackendInitialData;
  initialPricing?: PricingConfigPayload;
  initialTruckBalances?: ConductorTruckBalance[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const {
    enabled,
    loaded,
    error,
    multiWarehouse,
    canManageWarehouses,
    warehouses,
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
  } = useInventoryBackend(initialData);
  const {
    countries: pricingCountries,
    setCountries: setPricingCountries,
    setPromotions: setPricingPromotions,
    reload: reloadPricing,
  } = usePricingBackend(initialPricing);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [warehouseSaving, setWarehouseSaving] = useState(false);
  const [assignDraft, setAssignDraft] = useState<AssignDraft | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignmentDrawerItemId, setAssignmentDrawerItemId] = useState<string | null>(
    null,
  );
  const [closingAssignmentId, setClosingAssignmentId] = useState("");
  const [productCountriesDraft, setProductCountriesDraft] =
    useState<InventoryCatalogProduct | null>(null);
  const [truckTabOpen, setTruckTabOpen] = useState(false);
  const [truckBalances, setTruckBalances] = useState(initialTruckBalances);

  const activeWarehouseName =
    warehouses.find((warehouse) => warehouse.id === warehouseId)?.name || "";
  const truckQty = truckBalances.reduce((total, balance) => total + balance.totalQty, 0);
  const returnTo = useMemo(
    () => readInventarioReturnTo(searchParams),
    [searchParams],
  );
  const returnActionLabel = useMemo(
    () => (returnTo ? inventarioReturnActionLabel(returnTo) : null),
    [returnTo],
  );
  const showWarehouseSettings = searchParams.get("bodegas") === "1";

  const handleInventarioNavBack = useCallback(() => {
    if (showWarehouseSettings) {
      router.push("/inventario");
      return;
    }

    if (returnTo) {
      router.push(returnTo);
      return;
    }

    router.push("/");
  }, [returnTo, router, showWarehouseSettings]);

  const inventarioNavTitle = useMemo(() => {
    if (!loaded || !enabled) {
      return "Inventario";
    }

    if (!warehouses.length) {
      return "Inventario";
    }

    if (warehouseId && warehouses.length > 1) {
      return activeWarehouseName || "Inventario";
    }

    return "Inventario";
  }, [activeWarehouseName, enabled, loaded, warehouseId, warehouses.length]);

  useContextNav({
    title: showWarehouseSettings ? "Bodegas" : returnActionLabel || inventarioNavTitle,
    onBack: handleInventarioNavBack,
    target: returnTo ? ONBOARDING_TARGETS.INVENTORY_RETURN_PRICING : undefined,
    keepBrand: Boolean(returnTo),
    enabled: loaded && enabled,
  });

  useEffect(() => {
    if (!loaded || warehouseId || !warehouses.length) {
      return;
    }

    const target =
      warehouses.find((warehouse) => warehouse.is_default)?.id ||
      warehouses[0]?.id ||
      "";

    if (target) {
      setWarehouseId(target);
    }
  }, [loaded, warehouseId, warehouses, setWarehouseId]);

  useEffect(() => {
    if (!loaded || !categoryConfigs.length) {
      return;
    }

    queueMicrotask(() => {
      setInventoryItems((current) =>
        mergeTreeIntoInventoryItems(categoryConfigs, current),
      );
    });
  }, [categoryConfigs, loaded, setInventoryItems]);

  useEffect(() => {
    if (!error) {
      return;
    }

    notify.error(error);
  }, [error, notify]);

  function upsertInventoryItem(nextItem: InventoryStockItem) {
    setInventoryItems((current) => {
      const index = current.findIndex((entry) => entry.id === nextItem.id);

      if (index >= 0) {
        return current.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, ...nextItem } : entry,
        );
      }

      return [...current, nextItem];
    });
  }

  async function handleCloseAssignment(
    assignmentId: string,
    input: CloseAssignmentSubmit,
  ) {
    setClosingAssignmentId(assignmentId);

    const result = await closeInventoryAssignmentAction({
      assignmentId,
      outcome: input.outcome,
      qtyReturned: input.qtyReturned,
      qtyConsumed: input.qtyConsumed,
      qtyDamaged: input.qtyDamaged,
      qtyLost: input.qtyLost,
      note: input.note,
    });

    setClosingAssignmentId("");

    if (!result.ok) {
      notify.error(result.error);
      return false;
    }

    setAssignments((current) => current.filter((row) => row.id !== assignmentId));

    if (result.data.item) {
      upsertInventoryItem(result.data.item);
    }

    setMovements((current) => [...result.data.movements, ...current]);
    notify.success("Asignación cerrada");
    return true;
  }

  if (!loaded) {
    return <PageLoading inline />;
  }

  if (!enabled) {
    return (
      <SupabaseRequiredBanner detail="El inventario (categorías, stock y movimientos) se lee y guarda en Supabase por bodega." />
    );
  }

  if (showWarehouseSettings) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <WarehousesSettingsPanel />
      </div>
    );
  }

  async function createWarehouse() {
    const name = newWarehouseName.trim();

    if (!name || !canManageWarehouses) {
      return;
    }

    setWarehouseSaving(true);

    const result = await createWarehouseAction({ name });

    setWarehouseSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Bodega creada");

    setWarehouses((current) => [result.data, ...current]);
    setNewWarehouseName("");
    setWarehouseId(result.data.id);
  }

  function saveProductCountryAssignments(nextCountries: typeof pricingCountries) {
    setPricingCountries(nextCountries);

    if (!productCountriesDraft) {
      return;
    }

    const activeCountries = new Set(
      nextCountries
        .filter((country) =>
          country.boxes.some(
            (box) => (box.catalogKey || box.size) === productCountriesDraft.catalogKey,
          ),
        )
        .map((country) => country.name),
    );

    setPricingPromotions((current) =>
      current.filter(
        (promotion) =>
          promotion.catalogKey !== productCountriesDraft.catalogKey ||
          activeCountries.has(promotion.countryName),
      ),
    );
  }

  function warehouseCreateForm(compact = false) {
    if (!canManageWarehouses) {
      return (
        <p className="text-sm font-bold text-slate-400">
          Pide a un administrador que cree bodegas en{" "}
          <Link
            href={INVENTORY_WAREHOUSES_HREF}
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            Inventario → Bodegas
          </Link>
          .
        </p>
      );
    }

    if (!multiWarehouse && warehouses.length > 0) {
      return (
        <p className="text-sm font-bold text-slate-400">
          Activa{" "}
          <span className="text-slate-200">modo múltiples bodegas</span> en{" "}
          <Link
            href={INVENTORY_WAREHOUSES_HREF}
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            Inventario → Bodegas
          </Link>{" "}
          para agregar otra.
        </p>
      );
    }

    return (
      <div
        className={`inset-shell flex w-full items-center gap-2 rounded-xl bg-[#111827] p-2 ${compact ? "max-w-md" : "max-w-sm sm:w-80"}`}
      >
        <input
          className={`min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500 ${compact ? "h-10" : "h-9"}`}
          placeholder="Nombre de bodega"
          value={newWarehouseName}
          onChange={(event) => setNewWarehouseName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void createWarehouse();
            }
          }}
          autoFocus={compact}
        />
        <button
          type="button"
          onClick={() => void createWarehouse()}
          disabled={warehouseSaving}
          className={`flex shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 disabled:opacity-50 ${compact ? "h-10 w-10" : "h-9 w-9"}`}
          title="Crear bodega"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  }

  if (!warehouseId && !warehouses.length) {
    return (
      <section className="rounded-xl border border-black bg-[#25302c] p-5 shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
        <div className="mx-auto flex min-h-[24rem] max-w-xl flex-col items-center justify-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Warehouse className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-3xl font-black text-[#f8fafc]">
            Crea tu primera bodega
          </h1>
          <p className="mt-1 text-sm font-bold text-slate-400">
            Las categorias se comparten. El stock vive dentro de cada bodega.
          </p>
          <div className="mt-5 w-full">{warehouseCreateForm(true)}</div>
        </div>
      </section>
    );
  }

  if (!warehouseId) {
    return <PageLoading inline />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <InventoryStructureEditor
        embedded
        pricingReturnHref={returnTo}
        pricingReturnLabel={returnActionLabel}
        categoryConfigs={categoryConfigs}
        onCategoryConfigsChange={setCategoryConfigs}
        inventoryItems={inventoryItems}
        onInventoryItemsChange={setInventoryItems}
        warehouseId={warehouseId}
        warehouseName={activeWarehouseName}
        movements={movements}
        assignments={assignments}
        onMovementRecorded={(movement) =>
          setMovements((current) => [movement, ...current])
        }
        onAssignItem={(context) => {
          setAssignDraft({
            itemName: context.treeItem.name,
            maxQty: context.stockItem.stock,
            resolveItemId: async () => {
              if (
                !context.stockItem.id.startsWith("virtual-") &&
                !context.stockItem.id.startsWith("inv-")
              ) {
                return context.stockItem.id;
              }

              const ensured = await ensureInventoryItemForLeafAction({
                warehouseId: warehouseId!,
                category: context.categoryName,
                kind: context.treeItem.name,
                subcategory: context.subcategoryName,
                itemName: context.treeItem.name,
                minStock: context.stockItem.minStock,
              });

              if (!ensured.ok) {
                notify.error(ensured.error);
                return null;
              }

              upsertInventoryItem(ensured.data.item);
              return ensured.data.itemId;
            },
          });
        }}
        onManageProductCountries={(context) => {
          void reloadPricing();
          setProductCountriesDraft(
            catalogProductFromLeaf({
              category: context.categoryName,
              kind: context.treeItem.name,
              subcategory: context.subcategoryName,
              name: context.treeItem.name,
            }),
          );
        }}
        onViewItemAssignments={(itemId) => setAssignmentDrawerItemId(itemId)}
        showCategoryCreate
        showStructureDelete
        truckQty={truckQty}
        truckTabOpen={truckTabOpen}
        onTruckTabChange={setTruckTabOpen}
        truckPanel={
          <InventoryTruckPanel
            initialBalances={truckBalances}
            onBalancesChange={setTruckBalances}
          />
        }
        headerSlot={
          <>
            <InventoryWarehouseBar
              compact
              warehouses={warehouses}
              warehouseId={warehouseId}
              onChange={setWarehouseId}
            />
          </>
        }
        toolbarEndSlot={
          <InventoryControlMenu
            variant="menu"
            warehouseId={warehouseId}
            warehouseName={activeWarehouseName}
            assignments={assignments}
            movements={movements}
            initialItemId={assignmentDrawerItemId}
            onAssignmentsChange={setAssignments}
            onMovementsChange={setMovements}
            onCloseAssignment={handleCloseAssignment}
            closingAssignmentId={closingAssignmentId}
          />
        }
      />

      <AssignInventoryModal
        open={Boolean(assignDraft)}
        itemName={assignDraft?.itemName || ""}
        maxQty={assignDraft?.maxQty || 0}
        saving={assignSaving}
        onClose={() => setAssignDraft(null)}
        onSubmit={async ({ assigneeId, qty, note }) => {
          if (!assignDraft || !warehouseId) {
            return;
          }

          setAssignSaving(true);
          const itemId = await assignDraft.resolveItemId();
          setAssignSaving(false);

          if (!itemId) {
            return;
          }

          setAssignSaving(true);
          const result = await assignInventoryItemAction({
            warehouseId,
            itemId,
            assigneeId,
            qty,
            note,
          });
          setAssignSaving(false);

          if (!result.ok) {
            notify.error(result.error);
            return;
          }

          upsertInventoryItem(result.data.item);
          setAssignments((current) => [result.data.assignment, ...current]);
          setMovements((current) => [result.data.movement, ...current]);
          setAssignDraft(null);
          notify.success("Item asignado");
        }}
      />

      <ProductCountriesModal
        open={Boolean(productCountriesDraft)}
        product={productCountriesDraft}
        countries={pricingCountries}
        onClose={() => setProductCountriesDraft(null)}
        onSave={saveProductCountryAssignments}
      />
    </div>
  );
}
