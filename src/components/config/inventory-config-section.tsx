"use client";

import { useEffect, useRef } from "react";
import { InventoryStructureEditor } from "@/components/inventory-structure-editor";
import { PageLoading } from "@/components/page-loading";
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
  const lastMergedCategoriesRef = useRef("");

  useEffect(() => {
    if (!loaded || !categoryConfigs.length) {
      return;
    }

    const snapshot = JSON.stringify(categoryConfigs);

    if (snapshot === lastMergedCategoriesRef.current) {
      return;
    }

    lastMergedCategoriesRef.current = snapshot;

    queueMicrotask(() => {
      setInventoryItems((current) => mergeTreeIntoInventoryItems(categoryConfigs, current));
    });
  }, [categoryConfigs, loaded, setInventoryItems]);

  if (!loaded) {
    return <PageLoading inline />;
  }

  if (!enabled) {
    return (
      <SupabaseRequiredBanner detail="El catálogo de inventario se guarda en Supabase. Las categorías e ítems son compartidos; el stock es por bodega." />
    );
  }

  return (
    <>
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm font-bold text-amber-100">
          {error}
        </p>
      ) : null}
      <div className="flex min-h-[min(70dvh,48rem)] flex-col">
        <InventoryStructureEditor
          embedded
          showCategoryCreate={showCategoryCreate}
          categoryConfigs={categoryConfigs}
          onCategoryConfigsChange={setCategoryConfigs}
          inventoryItems={inventoryItems}
          onInventoryItemsChange={setInventoryItems}
        />
      </div>
    </>
  );
}
