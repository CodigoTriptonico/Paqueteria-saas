"use client";

import { ChevronLeft, ChevronRight, MapPin, Package, Phone, Plus, User } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { CountryName } from "@/components/country-flag";
import {
  DEFAULT_SALE_PERSON_CARD_VARIANT_ID,
  resolveSalePersonCardVariant,
  type SalePersonCardVariantId,
} from "@/components/sale/sale-person-card-variants";
import {
  Flag,
  type SalePersonAddress,
  salePersonAddressLines,
  salePersonAddressSummary,
} from "@/components/sale/venta-parts";

import {
  flowPersonListCountClass,
  flowPersonListFooterClass,
} from "@/components/flow-form-styles";
import { formatSalePersonListCount, type SalePersonListCountKind } from "@/lib/sale-person-list-count";

const defaultVariant = resolveSalePersonCardVariant(DEFAULT_SALE_PERSON_CARD_VARIANT_ID);

/** Tarjeta operativa de persona — estilo por defecto (ámbar cálido). */
export const salePersonCardClass = `group flex h-full min-h-[12.5rem] w-full min-w-0 cursor-pointer flex-col items-center p-4 text-center focus-visible:outline-none ${defaultVariant.focusRing} ${defaultVariant.card}`;

export const salePersonCardAddClass =
  "flex h-full min-h-[12.5rem] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-900/25 bg-[#2f281f]/50 p-4 text-center transition-colors hover:border-amber-600/40 hover:bg-amber-400/5";

export const salePersonCardEmptyClass =
  "col-span-full flex min-h-[5.25rem] items-center justify-center rounded-xl border border-amber-800/40 bg-[#2f281f] px-4 text-center text-sm font-black text-amber-100/85";

export const salePersonRowEmptyClass =
  "px-4 py-8 text-center text-sm font-black text-slate-400";

type SalePersonCardProps = {
  name: string;
  phone: string;
  address: SalePersonAddress;
  country: string;
  cardStyle?: SalePersonCardVariantId | string | null;
  hint?: string;
  hintHighlighted?: boolean;
  onQuickSale?: () => void;
  quickSaleLabel?: string;
  onIconClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  onClick: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  contextProps?: Record<string, string | undefined>;
};

function SalePersonAddressBlock({
  address,
  variant,
}: {
  address: SalePersonAddress;
  variant: ReturnType<typeof resolveSalePersonCardVariant>;
}) {
  const lines = salePersonAddressLines(address);
  const summary = lines.join(", ");

  if (!lines.length) {
    return (
      <div className={`w-full px-3 py-3 ${variant.addressEmpty}`}>
        <p className="text-sm font-bold text-current opacity-40">Sin dirección registrada</p>
      </div>
    );
  }

  return (
    <div className={`w-full flex-1 px-3 py-3 ${variant.addressBlock}`} title={summary}>
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <MapPin className={`h-4 w-4 shrink-0 ${variant.mapPin}`} aria-hidden />
        {lines.map((line, index) => (
          <p
            key={`${line}-${index}`}
            className={`line-clamp-2 w-full text-sm font-bold leading-snug ${variant.addressText}`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

export function SalePersonCard({
  name,
  phone,
  address,
  country,
  cardStyle,
  hint,
  hintHighlighted = false,
  onQuickSale,
  quickSaleLabel = "Venta rápida",
  onIconClick,
  className,
  onClick,
  onKeyDown,
  onContextMenu,
  contextProps,
}: SalePersonCardProps) {
  const variant = resolveSalePersonCardVariant(cardStyle);
  const iconTitle = onIconClick ? "Cambiar estilo de tarjeta" : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      {...contextProps}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      className={`group flex h-full min-h-[12.5rem] w-full min-w-0 cursor-pointer flex-col items-center p-4 text-center focus-visible:outline-none ${variant.focusRing} ${variant.card}${className ? ` ${className}` : ""}`}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2.5">
        {onIconClick ? (
          <button
            type="button"
            title={iconTitle}
            aria-label={iconTitle}
            onClick={(event) => {
              event.stopPropagation();
              onIconClick(event);
            }}
            className={`flex h-11 w-11 shrink-0 items-center justify-center text-slate-950 transition hover:scale-105 active:scale-95 ${variant.iconWell}`}
          >
            <User className="h-5 w-5" />
          </button>
        ) : (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center text-slate-950 ${variant.iconWell}`}
          >
            <User className="h-5 w-5" />
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-black leading-none ${variant.countryBadge}`}
        >
          <Flag country={country} />
          {country}
        </span>
        <p className={`line-clamp-2 w-full text-lg font-black leading-snug ${variant.name}`}>
          {name}
        </p>
        <p className={`flex w-full items-center justify-center gap-1.5 text-sm font-bold ${variant.phone}`}>
          <Phone className="h-4 w-4 shrink-0" />
          <span className="truncate">{phone}</span>
        </p>

        <SalePersonAddressBlock address={address} variant={variant} />

        <div className="flex min-h-[1.125rem] w-full items-center justify-center">
          {hint ? (
            <p
              className={`text-xs font-black uppercase tracking-wide ${
                hintHighlighted ? variant.hintHighlighted : variant.hint
              }`}
            >
              {hint}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex min-h-7 w-full shrink-0 items-center justify-center">
        {onQuickSale ? (
          <button
            type="button"
            title={quickSaleLabel}
            aria-label={quickSaleLabel}
            onClick={(event) => {
              event.stopPropagation();
              onQuickSale();
            }}
            className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-black text-slate-950 transition active:scale-[0.98] ${variant.quickSale}`}
          >
            <Package className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            Venta rápida
          </button>
        ) : null}
      </div>
    </div>
  );
}

type SalePersonRowProps = {
  name: string;
  phone: string;
  address: SalePersonAddress;
  country: string;
  cardStyle?: SalePersonCardVariantId | string | null;
  hint?: string;
  hintHighlighted?: boolean;
  onQuickSale?: () => void;
  quickSaleLabel?: string;
  onIconClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  onClick: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  contextProps?: Record<string, string | undefined>;
};

export function SalePersonRow({
  name,
  phone,
  address,
  country,
  cardStyle,
  hint,
  hintHighlighted = false,
  onQuickSale,
  quickSaleLabel = "Venta rápida",
  onIconClick,
  className,
  onClick,
  onKeyDown,
  onContextMenu,
  contextProps,
}: SalePersonRowProps) {
  const variant = resolveSalePersonCardVariant(cardStyle);
  const addressSummary = salePersonAddressSummary(address);
  const iconTitle = onIconClick ? "Cambiar estilo de tarjeta" : undefined;

  return (
    <article
      role="button"
      tabIndex={0}
      {...contextProps}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      className={`px-3 py-1.5 transition-colors sm:px-4 ${variant.focusRing} hover:bg-surface-card-hover${className ? ` ${className}` : ""}`}
      data-sale-person-row
    >
      <div className="grid w-full min-w-0 cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 overflow-hidden sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:gap-x-3">
        {onIconClick ? (
          <button
            type="button"
            title={iconTitle}
            aria-label={iconTitle}
            onClick={(event) => {
              event.stopPropagation();
              onIconClick(event);
            }}
            className={`flex h-7 w-7 shrink-0 items-center justify-center text-slate-950 transition hover:scale-105 active:scale-95 ${variant.iconWell}`}
          >
            <User className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center text-slate-950 ${variant.iconWell}`}
          >
            <User className="h-3.5 w-3.5" />
          </span>
        )}

        <div className="min-w-0 py-0.5">
          <p className="truncate text-sm font-black leading-tight text-[#f8fafc]">{name}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden text-[10px] font-bold leading-none text-slate-500">
            <Phone className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{phone}</span>
            <CountryName
              name={country}
              size="xs"
              className="hidden shrink-0 sm:inline-flex"
              labelClassName="max-w-[5rem] truncate"
            />
          </div>
        </div>

        <div className="hidden min-w-0 sm:block">
          <p
            className={`truncate text-[11px] font-bold leading-snug ${addressSummary ? "text-slate-400" : "text-slate-600"}`}
            title={addressSummary || "Sin dirección registrada"}
          >
            {addressSummary ? (
              <>
                <MapPin className="mr-1 inline h-3 w-3 shrink-0 align-[-2px] text-slate-500" aria-hidden />
                {addressSummary}
              </>
            ) : (
              "Sin dirección"
            )}
          </p>
        </div>

        <div
          className="flex shrink-0 items-center justify-end gap-1.5"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {hint ? (
            <SalePersonStatBadge highlighted={hintHighlighted}>{hint}</SalePersonStatBadge>
          ) : null}
          {onQuickSale ? (
            <button
              type="button"
              title={quickSaleLabel}
              aria-label={quickSaleLabel}
              onClick={(event) => {
                event.stopPropagation();
                onQuickSale();
              }}
              className={`inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-black text-slate-950 transition active:scale-[0.98] ${variant.quickSale}`}
            >
              <Package className="h-3 w-3 shrink-0" strokeWidth={2.25} />
              <span className="hidden lg:inline">Rápida</span>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function SalePersonAddRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-card-hover sm:px-4"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
        <Plus className="h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm font-black text-emerald-300">{label}</span>
    </button>
  );
}

export function SalePersonStatBadge({
  children,
  highlighted = false,
}: {
  children: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-1.5 text-[10px] font-black ${
        highlighted
          ? "border-amber-600/40 bg-amber-400/15 text-amber-200"
          : "border-amber-950/50 bg-amber-400/10 text-amber-200"
      }`}
    >
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
      ? "inline-flex h-6 items-center gap-0.5 rounded-md border border-amber-950/40 bg-transparent px-1.5 text-[10px] font-black text-amber-200/50 transition hover:border-amber-700/40 hover:bg-amber-400/5 hover:text-amber-200"
      : "inline-flex h-6 items-center gap-0.5 rounded-md bg-amber-400 px-1.5 text-[10px] font-black text-slate-950 transition hover:bg-amber-300";

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
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-600/70 bg-amber-400/95 text-slate-950">
        <Plus className="h-5 w-5" />
      </span>
      <span className="text-sm font-black leading-tight text-amber-300">{label}</span>
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

type SalePersonListFooterProps = {
  visibleCount: number;
  totalCount?: number;
  kind: SalePersonListCountKind;
  filtered?: boolean;
};

export function SalePersonListFooter({
  visibleCount,
  totalCount,
  kind,
  filtered = false,
}: SalePersonListFooterProps) {
  const countLabel = formatSalePersonListCount(visibleCount, {
    kind,
    totalCount,
    filtered,
  });

  return (
    <div className={flowPersonListFooterClass}>
      <span className={flowPersonListCountClass}>{countLabel}</span>
    </div>
  );
}
