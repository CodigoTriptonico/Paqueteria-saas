"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Layers3,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import { StockBadgeDisplay } from "@/components/stock-badge";
import {
  accentEmeraldSolid,
  inputClass,
  primaryButtonClass,
} from "@/components/ui-blocks";
import { resolveCategoryStockItems } from "@/lib/inventory-stock";
import {
  categorySubcategories,
  type CategoryConfig,
} from "@/lib/inventory-tree";
import {
  addBtnClass,
  categoryCardClass,
  categoryHeaderClass,
  countBadgeClass,
  iconBtnClass,
  rowActionsBarClass,
  subcategoryPanelClass,
  subcategoryRowClass,
} from "@/lib/inventory-structure-utils";

function CountBadge({ count, title }: { count: number; title: string }) {
  return (
    <span
      className={countBadgeClass}
      title={title}
      aria-label={`${count} ${title}`}
    >
      {count}
    </span>
  );
}

export type InventoryCategorySidebarProps = {
  categoryQuery: string;
  setCategoryQuery: (value: string) => void;
  categoryConfigs: CategoryConfig[];
  filteredCategories: CategoryConfig[];
  selectedCategory: string;
  selectedSubcategoryId: string;
  editingCategory: string;
  editingCategoryName: string;
  setEditingCategoryName: (value: string) => void;
  setEditingCategory: (value: string) => void;
  openSubcategoryInput: string;
  setOpenSubcategoryInput: (value: string) => void;
  newNameByKey: Record<string, string>;
  setNewNameByKey: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingSubcategoryId: string;
  editingSubcategoryName: string;
  setEditingSubcategoryName: (value: string) => void;
  setEditingSubcategoryId: (value: string) => void;
  showStructureOptions: boolean;
  structureEditingEnabled: boolean;
  optionsOpen: boolean;
  setOptionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  optionsSummary: string;
  showNewCategoryInput: boolean;
  setShowNewCategoryInput: (value: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  showNewItemForm: boolean;
  setShowNewItemForm: (value: boolean) => void;
  selectedCategoryData: CategoryConfig | null;
  itemInputKey: string;
  itemPlaceholder: string;
  addingSubcategoryForSelectedCategory: boolean;
  inventoryItems: Parameters<typeof resolveCategoryStockItems>[0];
  selectCategory: (name: string) => void;
  selectSubcategory: (id: string) => void;
  saveCategory: (oldName: string) => void;
  deleteCategory: (name: string) => void;
  addSubcategory: (categoryName: string) => void;
  saveSubcategory: (categoryName: string, subcategoryId: string) => void;
  deleteSubcategory: (categoryName: string, subcategoryId: string) => void;
  addCategory: () => void;
  addItem: () => void;
  beginAddItem: () => void;
  beginAddSubcategory: () => void;
  openStructureOptions: (opts?: { addCategory?: boolean; addItem?: boolean }) => void;
  subcategoryStockItems: (
    category: CategoryConfig,
    subcategoryName: string,
    childKindNames: string[],
  ) => ReturnType<typeof resolveCategoryStockItems>;
  renderSubcategoryForm: (compact?: boolean) => React.ReactNode;
};

export function InventoryCategorySidebar({
  categoryQuery,
  setCategoryQuery,
  categoryConfigs,
  filteredCategories,
  selectedCategory,
  selectedSubcategoryId,
  editingCategory,
  editingCategoryName,
  setEditingCategoryName,
  setEditingCategory,
  openSubcategoryInput,
  setOpenSubcategoryInput,
  newNameByKey,
  setNewNameByKey,
  editingSubcategoryId,
  editingSubcategoryName,
  setEditingSubcategoryName,
  setEditingSubcategoryId,
  showStructureOptions,
  structureEditingEnabled,
  optionsOpen,
  setOptionsOpen,
  optionsSummary,
  showNewCategoryInput,
  setShowNewCategoryInput,
  newCategoryName,
  setNewCategoryName,
  showNewItemForm,
  setShowNewItemForm,
  selectedCategoryData,
  addingSubcategoryForSelectedCategory,
  inventoryItems,
  selectCategory,
  selectSubcategory,
  saveCategory,
  deleteCategory,
  addSubcategory,
  saveSubcategory,
  deleteSubcategory,
  addCategory,
  beginAddItem,
  beginAddSubcategory,
  openStructureOptions,
  subcategoryStockItems,
  renderSubcategoryForm,
}: InventoryCategorySidebarProps) {
  function categoryStockItems(category: CategoryConfig) {
    return resolveCategoryStockItems(inventoryItems, category);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4">
      <div className="shrink-0 pb-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
          Categorías
        </p>
        <p className="text-xs font-bold text-slate-400">
          {filteredCategories.length}{" "}
          {filteredCategories.length === 1 ? "activa" : "activas"}
        </p>
      </div>

      <div className="shrink-0 pb-3">
        {categoryConfigs.length ? (
          <InlineSearchCombobox
            value={categoryQuery}
            onChange={setCategoryQuery}
            options={categoryConfigs.map((category) => ({
              value: category.name,
              label: category.name,
            }))}
            placeholder="Buscar categoría"
            emptyLabel="Sin categorías"
            ariaLabel="Buscar categorías"
            leadingIcon={<Search className="h-4 w-4" aria-hidden />}
            className="w-full"
            minWidthClass="w-full min-w-0"
            onSelectOption={(option) => selectCategory(option.label)}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex min-w-0 flex-col gap-2">
          {filteredCategories.map((currentCategory) => {
            const categorySelected = currentCategory.name === selectedCategory;
            const subs = categorySubcategories(currentCategory);
            const subCount = subs.length;
            const categoryStockItemsResolved = categoryStockItems(currentCategory);
            const editing = editingCategory === currentCategory.name;
            const isAddingSubcategory = openSubcategoryInput === currentCategory.name;

            return (
              <div
                key={currentCategory.name}
                className={`min-w-0 ${categoryCardClass(categorySelected)}`}
              >
                <div
                  className={categoryHeaderClass(
                    categorySelected && !selectedSubcategoryId,
                    categorySelected && subs.length > 0,
                  )}
                >
                  <div className="px-3 py-2.5">
                    {editing ? (
                      <input
                        className={`${inputClass} h-9 w-full text-sm`}
                        value={editingCategoryName}
                        onChange={(event) =>
                          setEditingCategoryName(event.target.value)
                        }
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectCategory(currentCategory.name)}
                        className="flex w-full min-w-0 items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                            categorySelected
                              ? accentEmeraldSolid
                              : "border-black bg-surface-inset text-slate-400"
                          }`}
                        >
                          <Layers3 className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-[#f8fafc]">
                          {currentCategory.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {subCount > 0 ? (
                            <CountBadge count={subCount} title="subcategorías" />
                          ) : null}
                          <StockBadgeDisplay
                            items={categoryStockItemsResolved}
                            title="Stock en categoría"
                          />
                        </span>
                      </button>
                    )}
                  </div>

                  {structureEditingEnabled && (categorySelected || editing) ? (
                    <div className={rowActionsBarClass}>
                      {editing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveCategory(currentCategory.name)}
                            className={addBtnClass}
                            title="Guardar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory("");
                              setEditingCategoryName("");
                            }}
                            className={iconBtnClass}
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenSubcategoryInput(
                                isAddingSubcategory ? "" : currentCategory.name,
                              );
                            }}
                            className={iconBtnClass}
                            title="Agregar subcategoría"
                            aria-label="Agregar subcategoría"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(currentCategory.name);
                              setEditingCategoryName(currentCategory.name);
                            }}
                            className={iconBtnClass}
                            title="Editar categoría"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCategory(currentCategory.name)}
                            className={iconBtnClass}
                            title="Borrar categoría"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>

                {structureEditingEnabled && isAddingSubcategory ? (
                  <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg border border-black bg-surface-inset px-2.5 py-2">
                    <input
                      className={`${inputClass} h-8 min-w-0 flex-1 border-0 bg-transparent text-sm`}
                      placeholder="Subcategoria"
                      value={newNameByKey[currentCategory.name] || ""}
                      onChange={(event) =>
                        setNewNameByKey((current) => ({
                          ...current,
                          [currentCategory.name]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          addSubcategory(currentCategory.name);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => addSubcategory(currentCategory.name)}
                      className={addBtnClass}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                {categorySelected && subs.length > 0 ? (
                  <div className={subcategoryPanelClass}>
                    <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Subcategorías
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {subs.map((subcategory) => {
                        const subSelected = selectedSubcategoryId === subcategory.id;
                        const subEditing = editingSubcategoryId === subcategory.id;
                        const subStockItems = subcategoryStockItems(
                          currentCategory,
                          subcategory.name,
                          (subcategory.children || []).map((child) => child.name),
                        );

                        return (
                          <div
                            key={subcategory.id}
                            className={subcategoryRowClass(subSelected)}
                          >
                            <div className="px-2 py-1.5">
                              {subEditing ? (
                                <input
                                  className={`${inputClass} h-8 w-full text-sm`}
                                  value={editingSubcategoryName}
                                  onChange={(event) =>
                                    setEditingSubcategoryName(event.target.value)
                                  }
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => selectSubcategory(subcategory.id)}
                                  className="flex w-full min-w-0 flex-col gap-1.5 text-left"
                                >
                                  <span className="flex items-start gap-1.5">
                                    <ChevronRight
                                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                        subSelected
                                          ? "text-emerald-400"
                                          : "text-slate-500"
                                      }`}
                                    />
                                    <span className="min-w-0 flex-1 break-words text-sm font-medium capitalize leading-snug text-slate-200">
                                      {subcategory.name}
                                    </span>
                                  </span>
                                  <span className="pl-5">
                                    <StockBadgeDisplay
                                      items={subStockItems}
                                      title="Stock en subcategoría"
                                    />
                                  </span>
                                </button>
                              )}
                            </div>

                            {structureEditingEnabled && (subSelected || subEditing) ? (
                              <div className={rowActionsBarClass}>
                                {subEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        saveSubcategory(
                                          currentCategory.name,
                                          subcategory.id,
                                        )
                                      }
                                      className={addBtnClass}
                                      title="Guardar"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSubcategoryId("");
                                        setEditingSubcategoryName("");
                                      }}
                                      className={iconBtnClass}
                                      title="Cancelar"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSubcategoryId(subcategory.id);
                                        setEditingSubcategoryName(subcategory.name);
                                      }}
                                      className={iconBtnClass}
                                      title="Editar subcategoría"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteSubcategory(
                                          currentCategory.name,
                                          subcategory.id,
                                        )
                                      }
                                      className={iconBtnClass}
                                      title="Borrar subcategoría"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!filteredCategories.length ? (
            <div className="px-4 py-6 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="mt-2 text-base font-black text-[#f8fafc]">Sin categorias</p>
              {showStructureOptions ? (
                <button
                  type="button"
                  onClick={() => openStructureOptions({ addCategory: true })}
                  className={`${primaryButtonClass} mt-3`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar categoría
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {showStructureOptions ? (
        <div className="mt-2 shrink-0 border-t border-black/70 pt-2">
          <div className="overflow-hidden rounded-lg border border-black/60 bg-[#151d1a]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
              onClick={() => setOptionsOpen((current) => !current)}
              aria-expanded={optionsOpen}
            >
              <Settings2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-300">
                {optionsOpen ? "Opciones de estructura" : optionsSummary}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${
                  optionsOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>

            {optionsOpen ? (
              <div className="max-h-52 space-y-2.5 overflow-y-auto border-t border-black/60 px-2.5 py-2.5">
                {!showNewCategoryInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewItemForm(false);
                      setShowNewCategoryInput(true);
                    }}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-black bg-surface-card px-2.5 text-xs font-black text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva categoría
                  </button>
                ) : (
                  <div className="flex items-center gap-1 rounded-md border border-black bg-surface-card p-1">
                    <input
                      className="h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 text-xs font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
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
                    <button
                      type="button"
                      onClick={addCategory}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950 hover:brightness-110"
                      title="Agregar categoría"
                      aria-label="Agregar categoría"
                    >
                      <Plus className="h-3.5 w-3.5" />
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
                )}

                {addingSubcategoryForSelectedCategory ? (
                  <div className="space-y-1">{renderSubcategoryForm(true)}</div>
                ) : (
                  <button
                    type="button"
                    disabled={!selectedCategoryData}
                    onClick={beginAddSubcategory}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-black bg-surface-card px-2.5 text-xs font-black text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva subcategoría
                  </button>
                )}

                {!showNewItemForm ? (
                  <button
                    type="button"
                    disabled={!selectedCategoryData}
                    onClick={beginAddItem}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-black bg-surface-card px-2.5 text-xs font-black text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar item
                  </button>
                ) : null}

                <p className="text-[11px] font-bold leading-snug text-slate-500">
                  La estructura es compartida entre bodegas.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
