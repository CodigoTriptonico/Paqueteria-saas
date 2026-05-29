"use client";

import { useEffect } from "react";
import { InventoryStructureEditor } from "@/components/inventory-structure-editor";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { useInventoryBackend } from "@/hooks/use-inventory-backend";
import { mergeTreeIntoInventoryItems } from "@/lib/inventory-stock";

type InventoryConfigSectionProps = {
  showCategoryCreate?: boolean;
};

export function InventoryConfigSection({
  showCategoryCreate = true,
}: InventoryConfigSectionProps) {
  const {
    enabled,
    loaded,
    error,
    categoryConfigs,
    setCategoryConfigs,
    inventoryItems,
    setInventoryItems,
  } = useInventoryBackend();

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
      <SupabaseRequiredBanner detail="La estructura de inventario se guarda en Supabase (inventory_categories e items por bodega)." />
    );
  }

  return (
    <>
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm font-bold text-amber-100">
          {error}
        </p>
      ) : null}
      <InventoryStructureEditor
        layout="inline"
        showCategoryCreate={showCategoryCreate}
        categoryConfigs={categoryConfigs}
        onCategoryConfigsChange={setCategoryConfigs}
        inventoryItems={inventoryItems}
        onInventoryItemsChange={setInventoryItems}
      />
    </>
  );
}
