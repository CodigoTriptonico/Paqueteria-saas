"use client";

import type { LucideIcon } from "lucide-react";
import type { MouseEvent, RefObject } from "react";

export const inventoryToolbarGroupClass =
  "flex shrink-0 items-center gap-1 rounded-lg border border-black bg-[#141a18] p-1";

export const inventoryToolbarRowClass =
  "flex min-h-11 min-w-0 flex-1 items-center gap-2 overflow-hidden";

export const inventoryToolbarCatalogGroupClass =
  "flex min-w-0 items-center gap-1 overflow-hidden rounded-lg border border-black bg-[#141a18] p-1";

export const inventoryToolbarDividerClass =
  "mx-0.5 h-6 w-px shrink-0 bg-black/80";

export const inventoryToolbarPickerShellClass =
  "box-border inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-md border-0 bg-[#1a2320] px-2";

export const inventoryToolbarPickerWidthClass =
  "w-[10.5rem] sm:w-[11.25rem]";

export const inventoryToolbarSubcategoryPickerWidthClass =
  "w-[11.75rem] sm:w-[12.5rem]";

export const inventoryToolbarChevronButtonClass =
  "inline-flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#243029] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-default disabled:hover:bg-transparent";

const baseClass =
  "group relative inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40";

const toneClass = {
  default:
    "bg-[#1a2320] text-slate-400 hover:bg-[#243029] hover:text-slate-200",
  primary:
    "border-emerald-700/60 bg-emerald-400 text-slate-950 hover:brightness-110",
  active:
    "border-emerald-500/60 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/20",
} as const;

export type InventoryToolbarIconButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  tone?: keyof typeof toneClass;
  badge?: number;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  ariaExpanded?: boolean;
  ariaHaspopup?: boolean | "menu" | "dialog";
  disabled?: boolean;
  onboardingTarget?: string;
  showLabel?: boolean;
  visibleLabel?: string;
};

export function InventoryToolbarIconButton({
  icon: Icon,
  label,
  onClick,
  tone = "default",
  badge,
  buttonRef,
  ariaExpanded,
  ariaHaspopup,
  disabled = false,
  onboardingTarget,
  showLabel = false,
  visibleLabel,
}: InventoryToolbarIconButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      data-onboarding-target={onboardingTarget}
      className={`${baseClass} ${showLabel ? "w-auto gap-1.5 px-3" : "w-9"} ${toneClass[tone]} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      {showLabel ? (
        <span className="text-xs font-black">{visibleLabel || label}</span>
      ) : null}
      {badge ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black bg-surface-inset px-1 text-[9px] font-black tabular-nums text-slate-200">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
