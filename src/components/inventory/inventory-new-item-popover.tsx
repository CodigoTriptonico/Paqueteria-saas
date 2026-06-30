"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  addBtnClass,
  STRUCTURE_MENU_WIDTH,
} from "@/lib/inventory-structure-utils";
import { type CategoryConfig, type InventoryTreeItem } from "@/lib/inventory-tree";

export type InventoryNewItemPopoverProps = {
  open: boolean;
  mounted: boolean;
  position: { top: number; left: number } | null;
  anchorRef: React.RefObject<HTMLElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  selectedCategoryData: CategoryConfig | null;
  selectedSubcategory: InventoryTreeItem | null;
  itemPlaceholder: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onClose: () => void;
};

export function InventoryNewItemPopover({
  open,
  mounted,
  position,
  anchorRef,
  panelRef,
  selectedCategoryData,
  selectedSubcategory,
  itemPlaceholder,
  value,
  onChange,
  onAdd,
  onClose,
}: InventoryNewItemPopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open, itemPlaceholder]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        anchorRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open, panelRef]);

  if (!open || !mounted || !position || !selectedCategoryData) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Nuevo item"
      className="fixed z-[125] space-y-1 rounded-xl border border-emerald-500/30 bg-[#101820] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
      style={{
        top: position.top,
        left: position.left,
        width: STRUCTURE_MENU_WIDTH,
      }}
    >
      <p className="px-1 text-[11px] font-black uppercase tracking-wide text-emerald-300">
        Nuevo item
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-black bg-[#111827] p-2">
        <button
          type="button"
          onClick={onAdd}
          className={addBtnClass}
          title="Agregar item"
          aria-label="Agregar item"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-[#f8fafc] outline-none placeholder:text-slate-500"
          placeholder={itemPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-surface-card-hover hover:text-[#f8fafc]"
          title="Cancelar"
          aria-label="Cancelar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="px-1 text-xs font-bold text-slate-500">
        En{" "}
        {selectedSubcategory
          ? `${selectedCategoryData.name} › ${selectedSubcategory.name}`
          : selectedCategoryData.name}
      </p>
    </div>,
    document.body,
  );
}
