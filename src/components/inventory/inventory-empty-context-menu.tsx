"use client";

import { FolderPlus, Layers3, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const INVENTORY_EMPTY_CONTEXT_MENU_ATTR = "data-inventory-empty-context-menu";

export type InventoryEmptyContextMenuState = {
  x: number;
  y: number;
};

export type InventoryEmptyContextMenuProps = {
  menu: InventoryEmptyContextMenuState | null;
  onClose: () => void;
  hasCategory: boolean;
  inSubcategory: boolean;
  onAddItem: () => void;
  onAddSubcategory: () => void;
  onAddCategory: () => void;
};

function clampPosition(x: number, y: number, width: number, height: number) {
  return {
    x: Math.max(12, Math.min(x, window.innerWidth - width - 12)),
    y: Math.max(12, Math.min(y, window.innerHeight - height - 12)),
  };
}

export function InventoryEmptyContextMenu({
  menu,
  onClose,
  hasCategory,
  inSubcategory,
  onAddItem,
  onAddSubcategory,
  onAddCategory,
}: InventoryEmptyContextMenuProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = () => onClose();

    const closeMenuOnPointerDown = (event: Event) => {
      if (event instanceof PointerEvent && event.button === 2) {
        return;
      }

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(`[${INVENTORY_EMPTY_CONTEXT_MENU_ATTR}]`)
      ) {
        return;
      }

      closeMenu();
    };

    window.addEventListener("pointerdown", closeMenuOnPointerDown);
    window.addEventListener("scroll", closeMenu, true);

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("pointerdown", closeMenuOnPointerDown);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menu, onClose]);

  if (!menu || !mounted) {
    return null;
  }

  const position = clampPosition(menu.x, menu.y, 224, 200);

  return createPortal(
    <div
      data-inventory-empty-context-menu
      className="fixed z-[145] w-56 rounded-lg border border-black bg-[#17211d] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="border-b border-white/10 px-2 py-2">
        <p className="text-sm font-black text-[#f8fafc]">Inventario</p>
        <p className="text-xs font-bold text-slate-400">
          {hasCategory
            ? inSubcategory
              ? "Agregar en esta subcategoría"
              : "Agregar en esta categoría"
            : "Crear estructura"}
        </p>
      </div>
      <button
        type="button"
        disabled={!hasCategory}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => {
          onAddItem();
          onClose();
        }}
        className="mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-emerald-200 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        Nuevo item
      </button>
      <button
        type="button"
        disabled={!hasCategory}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => {
          onAddSubcategory();
          onClose();
        }}
        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Layers3 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        Nueva subcategoría
      </button>
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => {
          onAddCategory();
          onClose();
        }}
        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black text-slate-200 hover:bg-surface-card-hover"
      >
        <FolderPlus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        Nueva categoría
      </button>
    </div>,
    document.body,
  );
}
