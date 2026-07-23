"use client";

import { GripVertical, Tags, Trash2 } from "lucide-react";
import {
  useEffect,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CompactInfoDisclosure, iconWellEmerald } from "@/components/ui-blocks";
import {
  describeComboRuleShort,
  type PricingPromotionConfig,
} from "@/lib/pricing-promotions";

type PromotionSortableListProps = {
  promotions: PricingPromotionConfig[];
  productLabels: Record<string, string>;
  onReorder: (orderedIds: string[]) => void;
  onEdit: (promotion: PricingPromotionConfig) => void;
  onToggleActive: (promotionId: string) => void;
  onRemove: (promotionId: string) => void;
};

type PromotionContextMenu = {
  promotionId: string;
  x: number;
  y: number;
};

export function PromotionSortableList({
  promotions,
  productLabels,
  onReorder,
  onEdit,
  onToggleActive,
  onRemove,
}: PromotionSortableListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<PromotionContextMenu | null>(null);
  const canReorder = promotions.length > 1;
  const contextPromotion = contextMenu
    ? promotions.find((promotion) => promotion.id === contextMenu.promotionId)
    : undefined;

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenuOnPointerDown = (event: Event) => {
      if (event instanceof PointerEvent && event.button === 2) {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest("[data-promotion-context-menu]")) {
        return;
      }

      setContextMenu(null);
    };

    const closeMenuOnScroll = () => {
      setContextMenu(null);
    };

    window.addEventListener("pointerdown", closeMenuOnPointerDown);
    window.addEventListener("scroll", closeMenuOnScroll, true);

    return () => {
      window.removeEventListener("pointerdown", closeMenuOnPointerDown);
      window.removeEventListener("scroll", closeMenuOnScroll, true);
    };
  }, [contextMenu]);

  function movePromotion(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    const ids = promotions.map((promotion) => promotion.id);
    const fromIndex = ids.indexOf(sourceId);
    const toIndex = ids.indexOf(targetId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const nextIds = [...ids];
    nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, sourceId);
    onReorder(nextIds);
  }

  function handleDragStart(promotionId: string) {
    setDraggingId(promotionId);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, promotionId: string) {
    event.preventDefault();

    if (promotionId !== draggingId) {
      setOverId(promotionId);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, promotionId: string) {
    event.preventDefault();

    const sourceId = event.dataTransfer.getData("text/plain") || draggingId;

    if (sourceId) {
      movePromotion(sourceId, promotionId);
    }

    setDraggingId(null);
    setOverId(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverId(null);
  }

  function openContextMenu(
    event: ReactMouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>,
    promotionId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      promotionId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function promotionContextMenuProps(promotionId: string) {
    return {
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) =>
        openContextMenu(event, promotionId),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 2) {
          return;
        }

        openContextMenu(event, promotionId);
      },
    };
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase text-slate-500">Prioridad</span>
        <CompactInfoDisclosure ariaLabel="Cómo ordenar y editar promociones">
          {canReorder
            ? "Arrastra para cambiar la prioridad. Clic derecho para más opciones."
            : "Clic derecho para más opciones."}
        </CompactInfoDisclosure>
      </div>

      <div className="overflow-hidden rounded-xl border border-black bg-surface-card">
        {promotions.map((promotion, index) => {
          const isDragging = draggingId === promotion.id;
          const isOver = overId === promotion.id && draggingId !== promotion.id;

          return (
            <div
              key={promotion.id}
              onDragOver={(event) => handleDragOver(event, promotion.id)}
              onDrop={(event) => handleDrop(event, promotion.id)}
              className={`grid cursor-context-menu gap-3 border-b border-black/70 p-3 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-center ${
                isDragging ? "opacity-50" : ""
              } ${isOver ? "bg-emerald-950/20" : ""}`}
              {...promotionContextMenuProps(promotion.id)}
            >
              {canReorder ? (
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", promotion.id);
                    handleDragStart(promotion.id);
                  }}
                  onDragEnd={handleDragEnd}
                  className="flex h-10 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-500 transition hover:bg-surface-card-hover hover:text-slate-300 active:cursor-grabbing"
                  aria-label={`Reordenar ${promotion.name}`}
                  title="Arrastrar para reordenar"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              ) : (
                <span className="hidden sm:block sm:w-8" aria-hidden />
              )}

              <button
                type="button"
                onClick={() => onEdit(promotion)}
                className="min-w-0 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className={`h-10 w-10 shrink-0 ${iconWellEmerald}`}>
                    <Tags className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-black text-[#f8fafc]">
                        {promotion.name}
                      </span>
                      {canReorder ? (
                        <span className="rounded-md border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-500">
                          #{index + 1}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs font-bold text-slate-400">
                      {describeComboRuleShort(promotion.rule, productLabels)}
                    </span>
                  </span>
                </div>
              </button>

              <div className="flex items-center justify-end gap-2 sm:col-start-3">
                <span
                  className={`inline-flex h-8 items-center rounded-lg border border-black px-2 text-[10px] font-black uppercase ${
                    promotion.active
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-surface-inset text-slate-400"
                  }`}
                >
                  {promotion.active ? "Activa" : "Pausada"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {contextMenu && contextPromotion ? (
        <div
          role="menu"
          data-promotion-context-menu
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-black px-3 py-2">
            <p className="truncate text-sm font-black text-[#f8fafc]">{contextPromotion.name}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-hover"
            onClick={() => {
              onEdit(contextPromotion);
              setContextMenu(null);
            }}
          >
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-hover"
            onClick={() => {
              onToggleActive(contextPromotion.id);
              setContextMenu(null);
            }}
          >
            {contextPromotion.active ? "Pausar" : "Activar"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-rose-200 hover:bg-[#3A1818]"
            onClick={() => {
              onRemove(contextPromotion.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        </div>
      ) : null}
    </div>
  );
}
