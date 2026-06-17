"use client";

import { ChevronLeft, ChevronRight, MapPin, Phone, Plus, User } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { iconWellEmerald } from "@/components/ui-blocks";
import { Flag } from "@/components/sale/venta-parts";

/** Tarjeta operativa de persona — layout horizontal, ancho completo en grilla. */
export const salePersonCardClass =
  "group flex h-full min-h-[6.75rem] w-full min-w-0 cursor-pointer flex-col rounded-xl border border-black bg-[#3a4842] p-3 text-left shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-[#425048] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40";

export const salePersonCardAddClass =
  "flex h-full min-h-[6.75rem] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/12 bg-surface-inset/50 p-3 text-center transition-colors hover:border-emerald-600/40 hover:bg-emerald-400/5";

export const salePersonCardEmptyClass =
  "col-span-full flex min-h-[5.25rem] items-center justify-center rounded-xl border border-black bg-surface-inset px-4 text-center text-sm font-black text-slate-400";

type SalePersonCardProps = {
  name: string;
  phone: string;
  location: string;
  country: string;
  className?: string;
  footer?: ReactNode;
  onClick: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  contextProps?: Record<string, string | undefined>;
};

export function SalePersonCard({
  name,
  phone,
  location,
  country,
  className,
  footer,
  onClick,
  onKeyDown,
  onContextMenu,
  contextProps,
}: SalePersonCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      {...contextProps}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      className={`${salePersonCardClass}${className ? ` ${className}` : ""}`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start gap-2.5">
          <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
            <User className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 min-w-0 flex-1 text-sm font-black leading-snug text-[#f8fafc]">
                {name}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-black bg-[#202926] px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-200">
                <Flag country={country} />
                {country}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-slate-400">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{phone}</span>
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/70 pt-2">
          <p className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] font-bold text-slate-400">
            <MapPin className="h-3 w-3 shrink-0 text-emerald-400" />
            <span className="truncate">{location || "—"}</span>
          </p>
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SalePersonStatBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-black bg-emerald-400/10 px-1.5 text-[10px] font-black text-emerald-200">
      {children}
    </span>
  );
}

export function SalePersonActionButton({
  children,
  title,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  title: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "ghost";
}) {
  const className =
    variant === "ghost"
      ? "inline-flex h-6 items-center gap-0.5 rounded-md border border-black/50 bg-transparent px-1.5 text-[10px] font-black text-slate-400 transition hover:border-emerald-700/40 hover:bg-emerald-400/5 hover:text-emerald-200"
      : "inline-flex h-6 items-center gap-0.5 rounded-md bg-emerald-400 px-1.5 text-[10px] font-black text-slate-950 transition hover:bg-emerald-300";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export function SalePersonAddCard({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${salePersonCardAddClass}${className ? ` ${className}` : ""}`}
    >
      <span className={`h-8 w-8 ${iconWellEmerald}`}>
        <Plus className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-black leading-tight text-emerald-300">{label}</span>
    </button>
  );
}

type SalePersonPagerProps = {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
};

export function SalePersonPager({
  page,
  pageCount,
  onPrev,
  onNext,
  prevLabel = "Anterior",
  nextLabel = "Siguiente",
}: SalePersonPagerProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 0}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-[#f8fafc] transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={prevLabel}
        title={prevLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[2.75rem] px-1 text-center text-xs font-black text-slate-300">
        {page + 1}/{pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount - 1}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-[#f8fafc] transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={nextLabel}
        title={nextLabel}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
