"use client";

import { Check, Plus, X } from "lucide-react";
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
  structureMenuPosition: { top: number; left: number } | null;
  structureMenuMounted: boolean;
  structurePanelRef: React.RefObject<HTMLDivElement | null>;
  showNewItemForm: boolean;
  setShowNewItemForm: (value: boolean) => void;
  showNewCategoryInput: boolean;
  setShowNewCategoryInput: (value: boolean) => void;
  setOpenSubcategoryInput: (value: string) => void;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  selectedCategoryData: CategoryConfig | null;
  selectedSubcategory: InventoryTreeItem | null;
  addingSubcategoryForSelectedCategory: boolean;
  newNameByKey: Record<string, string>;
  setNewNameByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  itemInputKey: string;
  itemPlaceholder: string;
  addItem: () => void;
  addCategory: () => void;
  beginAddItem: () => void;
  beginAddSubcategory: () => void;
  renderSubcategoryForm: (compact?: boolean) => React.ReactNode;
};

export function InventoryStructureOptionsMenu({
  embedded,
  showStructureOptions,
  optionsOpen,
  structureMenuPosition,
  structureMenuMounted,
  structurePanelRef,
  showNewItemForm,
  setShowNewItemForm,
  showNewCategoryInput,
  setShowNewCategoryInput,
  setOpenSubcategoryInput,
  newCategoryName,
  setNewCategoryName,
  selectedCategoryData,
  selectedSubcategory,
  addingSubcategoryForSelectedCategory,
  newNameByKey,
  setNewNameByKey,
  itemInputKey,
  itemPlaceholder,
  addItem,
  addCategory,
  beginAddItem,
  beginAddSubcategory,
  renderSubcategoryForm,
}: InventoryStructureOptionsMenuProps) {
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
        Estructura
      </p>
      {showNewItemForm ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
            Nuevo item
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-black bg-[#111827] p-2">
            <button
              type="button"
              disabled={!selectedCategoryData}
              onClick={() => addItem()}
              className={addBtnClass}
              title="Agregar item"
              aria-label="Agregar item"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <input
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
              placeholder={itemPlaceholder}
              value={newNameByKey[itemInputKey] || ""}
              onChange={(event) =>
                setNewNameByKey((current) => ({
                  ...current,
                  [itemInputKey]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addItem();
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowNewItemForm(false)}
              className={iconBtnClass}
              title="Cancelar"
              aria-label="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {!selectedCategoryData ? (
            <p className="text-[11px] font-bold text-slate-500">
              Elige una categoría para agregar items.
            </p>
          ) : (
            <p className="text-[11px] font-bold text-slate-500">
              En{" "}
              {selectedSubcategory
                ? `${selectedCategoryData.name} › ${selectedSubcategory.name}`
                : selectedCategoryData.name}
            </p>
          )}
        </div>
      ) : addingSubcategoryForSelectedCategory ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
            Nueva subcategoría
          </p>
          {renderSubcategoryForm(true)}
          <p className="text-[11px] font-bold text-slate-500">
            Dentro de {selectedCategoryData?.name}
          </p>
        </div>
      ) : (
        <>
          {showNewCategoryInput ? (
            <div className="flex items-center gap-2 rounded-lg border border-black bg-[#111827] p-2">
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
                setShowNewItemForm(false);
                setOpenSubcategoryInput("");
                setShowNewCategoryInput(true);
              }}
              className={`${secondaryButtonClass} h-9 w-full text-xs`}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva categoría
            </button>
          )}

          <button
            type="button"
            disabled={!selectedCategoryData}
            onClick={beginAddSubcategory}
            className={`${secondaryButtonClass} h-9 w-full text-xs disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva subcategoría
          </button>

          <button
            type="button"
            disabled={!selectedCategoryData}
            onClick={beginAddItem}
            className={`${secondaryButtonClass} h-9 w-full text-xs disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo item
          </button>
        </>
      )}

      <p className="text-[11px] font-bold leading-snug text-slate-500">
        La estructura es compartida entre bodegas.
      </p>
    </div>,
    document.body,
  );
}
