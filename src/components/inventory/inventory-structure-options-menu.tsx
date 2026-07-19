"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { secondaryButtonClass } from "@/components/ui-blocks";
import {
  addBtnClass,
  iconBtnClass,
  STRUCTURE_MENU_WIDTH,
} from "@/lib/inventory-structure-utils";
import { type CategoryConfig, type InventoryTreeItem } from "@/lib/inventory-tree";

export type InventoryStructureOptionsMenuProps = {
  embedded: boolean;
  showStructureOptions: boolean;
  optionsOpen: boolean;
  mode: "create" | "manage";
  structureMenuPosition: { top: number; left: number } | null;
  structureMenuMounted: boolean;
  structurePanelRef: React.RefObject<HTMLDivElement | null>;
  showNewCategoryInput: boolean;
  setShowNewCategoryInput: (value: boolean) => void;
  setOpenSubcategoryInput: (value: string) => void;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  selectedCategoryData: CategoryConfig | null;
  selectedSubcategory: InventoryTreeItem | null;
  addingSubcategoryForSelectedCategory: boolean;
  addCategory: () => void;
  beginAddSubcategory: () => void;
  renderSubcategoryForm: (compact?: boolean) => React.ReactNode;
  showStructureDelete?: boolean;
  selectedCategoryName: string;
  deleteCategory: (name: string) => void;
  deleteSubcategory: (categoryName: string, subcategoryId: string) => void;
};

const deleteButtonClass =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-red-900/70 bg-red-950/30 px-2.5 text-xs font-black text-red-300 hover:bg-red-950/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";

export function InventoryStructureOptionsMenu({
  embedded,
  showStructureOptions,
  optionsOpen,
  mode,
  structureMenuPosition,
  structureMenuMounted,
  structurePanelRef,
  showNewCategoryInput,
  setShowNewCategoryInput,
  setOpenSubcategoryInput,
  newCategoryName,
  setNewCategoryName,
  selectedCategoryData,
  selectedSubcategory,
  addingSubcategoryForSelectedCategory,
  addCategory,
  beginAddSubcategory,
  renderSubcategoryForm,
  showStructureDelete = false,
  selectedCategoryName,
  deleteCategory,
  deleteSubcategory,
}: InventoryStructureOptionsMenuProps) {
  function confirmDeleteCategory() {
    if (!selectedCategoryData) {
      return;
    }

    const name = selectedCategoryData.name;

    if (
      !window.confirm(
        `¿Eliminar la categoría "${name}"? También se quitarán sus subcategorías e ítems del catálogo.`,
      )
    ) {
      return;
    }

    deleteCategory(name);
  }

  function confirmDeleteSubcategory() {
    if (!selectedCategoryData || !selectedSubcategory) {
      return;
    }

    const name = selectedSubcategory.name;

    if (
      !window.confirm(
        `¿Eliminar la subcategoría "${name}" de ${selectedCategoryData.name}?`,
      )
    ) {
      return;
    }

    deleteSubcategory(selectedCategoryData.name, selectedSubcategory.id);
  }
  if (
    !embedded ||
    !showStructureOptions ||
    !optionsOpen ||
    !structureMenuPosition ||
    !structureMenuMounted
  ) {
    return null;
  }

  return createPortal(
    <div
      ref={structurePanelRef}
      role="menu"
      className="fixed z-[120] flex max-h-[min(24rem,calc(100dvh-5rem))] flex-col gap-2 overflow-y-auto rounded-lg border border-black bg-[#101820] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
      style={{
        top: structureMenuPosition.top,
        left: structureMenuPosition.left,
        width: STRUCTURE_MENU_WIDTH,
      }}
    >
      <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
        {mode === "manage" ? "Gestionar estructura" : "Crear estructura"}
      </p>
      {mode === "create" && addingSubcategoryForSelectedCategory ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
            Nueva subcategoría
          </p>
          {renderSubcategoryForm(true)}
          <p className="text-[11px] font-bold text-slate-500">
            Dentro de {selectedCategoryData?.name}
          </p>
        </div>
      ) : mode === "create" ? (
        <>
          <button
            type="button"
            disabled={!selectedCategoryData}
            onClick={beginAddSubcategory}
            className={`${secondaryButtonClass} h-9 w-full text-xs disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva subcategoría
          </button>

          {showNewCategoryInput ? (
            <div className="inset-shell flex items-center gap-2 rounded-lg border border-black bg-[#111827] p-2">
              <input
                className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
                placeholder="Nueva categoría"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addCategory();
                  }
                }}
                autoFocus
              />
              <button type="button" onClick={addCategory} className={addBtnClass}>
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewCategoryInput(false);
                  setNewCategoryName("");
                }}
                className={iconBtnClass}
                title="Cancelar"
                aria-label="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpenSubcategoryInput("");
                setShowNewCategoryInput(true);
              }}
              className={`${secondaryButtonClass} h-9 w-full text-xs`}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva categoría
            </button>
          )}
        </>
      ) : null}

      {showStructureDelete && mode === "manage" ? (
        <div className="space-y-2 border-t border-black/70 pt-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Eliminar
          </p>
          <button
            type="button"
            disabled={!selectedSubcategory}
            onClick={confirmDeleteSubcategory}
            className={deleteButtonClass}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar subcategoría
          </button>
          <button
            type="button"
            disabled={!selectedCategoryName}
            onClick={confirmDeleteCategory}
            className={deleteButtonClass}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar categoría
          </button>
        </div>
      ) : null}

      <p className="text-[11px] font-bold leading-snug text-slate-500">
        La estructura es compartida entre bodegas.
      </p>
    </div>,
    document.body,
  );
}
