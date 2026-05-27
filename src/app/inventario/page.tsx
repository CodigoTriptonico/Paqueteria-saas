"use client";

import { useEffect, useState } from "react";
import { InventoryStructureEditor } from "@/components/inventory-structure-editor";
import type { CategoryConfig } from "@/lib/inventory-tree";

const STORAGE_KEY = "paquemas-inventory-v3";

export default function InventarioPage() {
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as { categoryConfigs?: CategoryConfig[] };

        if (parsed.categoryConfigs?.length) {
          setCategoryConfigs(parsed.categoryConfigs);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ categoryConfigs, items: [], movements: [] }),
    );
  }, [categoryConfigs, loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <InventoryStructureEditor
      categoryConfigs={categoryConfigs}
      onCategoryConfigsChange={setCategoryConfigs}
    />
  );
}
