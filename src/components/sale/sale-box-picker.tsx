"use client";

import { Package } from "lucide-react";
import type { MouseEvent } from "react";
import {
  flowPersonRowListFrameClass,
  flowPersonRowListInnerClass,
} from "@/components/flow-form-styles";

const saleBoxCardGridClass =
  "grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]";
import { listRowBaseClass, listRowHoverClass } from "@/components/ui-blocks";
import { SaleBoxCartQtyBadge } from "@/components/sale/venta-parts";
import type { ViewLayout } from "@/lib/view-layout";

type SaleBoxPickerProps = {
  boxes: string[][];
  viewLayout: ViewLayout;
  getCartQuantity: (box: string[]) => number | null;
  getPromoCount: (box: string[]) => number;
  getCardClass: (box: string[], selected: boolean) => string;
  onChoose: (box: string[]) => void;
  onRemove: (box: string[]) => void;
  firstBoxCoachTarget?: string;
};

function boxInteractionProps(
  box: string[],
  onChoose: (box: string[]) => void,
  onRemove: (box: string[]) => void,
) {
  return {
    type: "button" as const,
    onClick: () => onChoose(box),
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onRemove(box);
    },
    onMouseUp: (event: MouseEvent<HTMLElement>) => {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    title: `${box[0]}: clic izquierdo agrega, clic derecho quita`,
  };
}

function SaleBoxCard({
  box,
  cartQuantity,
  promoCount,
  className,
  coachTarget,
  onChoose,
  onRemove,
}: {
  box: string[];
  cartQuantity: number | null;
  promoCount: number;
  className: string;
  coachTarget?: string;
  onChoose: (box: string[]) => void;
  onRemove: (box: string[]) => void;
}) {
  return (
    <button
      {...boxInteractionProps(box, onChoose, onRemove)}
      data-onboarding-target={coachTarget}
      className={`group flex w-full flex-col gap-3 rounded-xl border border-black bg-[#3f4b46] p-4 text-center shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-[#46544e] ${className}`}
    >
      <div className="flex min-w-0 flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 shadow-[0_8px_14px_rgba(16,185,129,0.2)]">
          <Package className="h-5 w-5" />
        </div>
        <p className="text-lg font-black leading-tight text-[#f8fafc]">{box[0]}</p>
      </div>

      <div className="w-full border-y border-white/10 py-2 text-xs font-black text-slate-300">
        <span className="block truncate rounded-md bg-[#202926] px-2 py-1.5">
          {box[4] || "Tiempo —"}
        </span>
      </div>

      <div className="w-full rounded-lg border border-black/70 bg-[#202926] px-3 py-2">
        <p className="text-[10px] font-black uppercase text-slate-400">Cobra</p>
        <p className="text-lg font-black">{box[1]}</p>
        {promoCount > 0 ? (
          <p className="mt-1 text-[10px] font-black uppercase text-emerald-300">
            {promoCount} promo
          </p>
        ) : null}
        {cartQuantity ? (
          <div className="mt-1 flex justify-center">
            <SaleBoxCartQtyBadge quantity={cartQuantity} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function SaleBoxRow({
  box,
  cartQuantity,
  promoCount,
  className,
  coachTarget,
  onChoose,
  onRemove,
}: {
  box: string[];
  cartQuantity: number | null;
  promoCount: number;
  className: string;
  coachTarget?: string;
  onChoose: (box: string[]) => void;
  onRemove: (box: string[]) => void;
}) {
  return (
    <button
      {...boxInteractionProps(box, onChoose, onRemove)}
      data-onboarding-target={coachTarget}
      className={`${listRowBaseClass} grid w-full grid-cols-[2rem_minmax(0,1fr)_minmax(0,6rem)_minmax(0,5.5rem)_auto] items-center gap-x-3 px-3 py-2.5 text-left sm:px-4 ${listRowHoverClass}${className ? ` ${className}` : ""}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
        <Package className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#f8fafc]">{box[0]}</p>
        <p className="truncate text-[10px] font-bold text-slate-500">{box[4] || "Tiempo —"}</p>
      </div>
      <p className="truncate text-sm font-black text-slate-200">{box[1]}</p>
      <p className="truncate text-[10px] font-black uppercase text-emerald-300">
        {promoCount > 0 ? `${promoCount} promo` : "\u00a0"}
      </p>
      {cartQuantity ? (
        <SaleBoxCartQtyBadge quantity={cartQuantity} />
      ) : (
        <span className="h-6 w-6" aria-hidden />
      )}
    </button>
  );
}

export function SaleBoxPicker({
  boxes,
  viewLayout,
  getCartQuantity,
  getPromoCount,
  getCardClass,
  onChoose,
  onRemove,
  firstBoxCoachTarget,
}: SaleBoxPickerProps) {
  if (viewLayout === "rows") {
    return (
      <div className={flowPersonRowListFrameClass}>
        <div className={flowPersonRowListInnerClass}>
          {boxes.map((box, boxIndex) => (
            <SaleBoxRow
              key={box[0]}
              box={box}
              cartQuantity={getCartQuantity(box)}
              promoCount={getPromoCount(box)}
              className={getCardClass(box, Boolean(getCartQuantity(box)))}
              coachTarget={boxIndex === 0 ? firstBoxCoachTarget : undefined}
              onChoose={onChoose}
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${saleBoxCardGridClass} items-start`}>
      {boxes.map((box, boxIndex) => (
        <SaleBoxCard
          key={box[0]}
          box={box}
          cartQuantity={getCartQuantity(box)}
          promoCount={getPromoCount(box)}
          className={getCardClass(box, Boolean(getCartQuantity(box)))}
          coachTarget={boxIndex === 0 ? firstBoxCoachTarget : undefined}
          onChoose={onChoose}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
