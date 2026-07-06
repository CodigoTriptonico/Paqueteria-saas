"use client";

import { ChevronDown, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PromotionSelector } from "@/components/sale/promotion-selector";
import { inputClass, primaryButtonClass } from "@/components/ui-blocks";
import type { InvoiceBillingSnapshot } from "@/lib/invoice-billing";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";

export type SaleCartPanelLine = {
  id: string;
  label: string;
  unitPrice: string;
  quantity: number;
};

type SaleCartPanelProps = {
  lines: SaleCartPanelLine[];
  billing: InvoiceBillingSnapshot | null;
  selectedPromotionId: string;
  onPromotionChange: (promotionId: string) => void;
  onAdjustQuantity: (lineId: string, delta: number) => void;
  onUpdateQuantity: (lineId: string, rawValue: string) => void;
  onRemoveLine: (lineId: string) => void;
  onContinue?: () => void;
  continueLabel?: string;
  emptyHint?: string;
  className?: string;
  /** Integrado en la barra de pasos (paso Caja), sin card lateral. */
  embedded?: boolean;
};

function lineSubtotal(line: SaleCartPanelLine) {
  return formatMoneyValue(parseMoneyValue(line.unitPrice) * line.quantity);
}

function cartShowsSubtotalBreakdown(billing: InvoiceBillingSnapshot) {
  return (
    parseMoneyValue(billing.promotionDiscount) > 0 ||
    parseMoneyValue(billing.logisticsSubtotal) > 0
  );
}

function CartContents({
  lines,
  billing,
  selectedPromotionId,
  onPromotionChange,
  onAdjustQuantity,
  onUpdateQuantity,
  onRemoveLine,
  onContinue,
  continueLabel = "Continuar",
  emptyHint = "Toca una caja para agregarla al carrito.",
}: SaleCartPanelProps) {
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (!lines.length) {
    return (
      <div className="rounded-lg border border-dashed border-black/80 bg-surface-inset px-4 py-8 text-center">
        <ShoppingCart className="mx-auto h-8 w-8 text-slate-500" aria-hidden />
        <p className="mt-3 text-sm font-black text-slate-400">Sin productos</p>
        <p className="mt-1 text-xs font-bold text-slate-500">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {lines.map((line) => (
          <div
            key={line.id}
            className="grid gap-2 rounded-lg border border-black bg-surface-panel p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#f8fafc]">{line.label}</p>
                <p className="text-xs font-bold text-slate-400">{line.unitPrice} c/u</p>
              </div>
              <p className="shrink-0 text-sm font-black tabular-nums text-emerald-300">
                {lineSubtotal(line)}
              </p>
            </div>
            <div className="grid grid-cols-[2.5rem_4rem_2.5rem_2.5rem] items-center gap-1">
              <button
                type="button"
                onClick={() => onAdjustQuantity(line.id, -1)}
                className="flex h-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-lg font-black text-slate-300"
                aria-label={`Restar ${line.label}`}
              >
                -
              </button>
              <input
                className={`${inputClass} h-9 px-1 text-center text-base font-black`}
                value={line.quantity}
                onChange={(event) => onUpdateQuantity(line.id, event.target.value)}
                inputMode="numeric"
                aria-label={`Cantidad ${line.label}`}
              />
              <button
                type="button"
                onClick={() => onAdjustQuantity(line.id, 1)}
                className="flex h-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-lg font-black text-slate-300"
                aria-label={`Agregar ${line.label}`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => onRemoveLine(line.id)}
                className="flex h-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-400 hover:text-rose-300"
                aria-label={`Quitar ${line.label}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {billing ? (
        <div className="grid gap-2 border-t border-black pt-3 text-sm">
          {cartShowsSubtotalBreakdown(billing) ? (
            <div className="flex items-center justify-between gap-3 font-bold text-slate-300">
              <span>Subtotal ({itemCount})</span>
              <span className="tabular-nums text-[#f8fafc]">
                {billing.boxSubtotalBeforeDiscount}
              </span>
            </div>
          ) : null}
          <PromotionSelector
            candidates={billing.promotionCandidates}
            selectedPromotionId={selectedPromotionId}
            onChange={onPromotionChange}
          />
          {parseMoneyValue(billing.promotionDiscount) > 0 ? (
            <div className="flex items-center justify-between gap-3 font-bold text-emerald-300">
              <span>{billing.promotion?.name || "Promoción"}</span>
              <span className="tabular-nums">-{billing.promotionDiscount}</span>
            </div>
          ) : null}
          {parseMoneyValue(billing.logisticsSubtotal) > 0 ? (
            <div className="flex items-center justify-between gap-3 font-bold text-slate-300">
              <span>Logística</span>
              <span className="tabular-nums text-[#f8fafc]">{billing.logisticsSubtotal}</span>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-between gap-3 font-black text-[#f8fafc] ${
              cartShowsSubtotalBreakdown(billing) ? "border-t border-black/70 pt-2" : ""
            }`}
          >
            <span>{cartShowsSubtotalBreakdown(billing) ? "Total" : `Total (${itemCount})`}</span>
            <span className="tabular-nums">{billing.quotedTotal}</span>
          </div>
        </div>
      ) : null}

      {onContinue && lines.length ? (
        <button type="button" onClick={onContinue} className={`${primaryButtonClass} w-full`}>
          {continueLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SaleCartPanel({
  lines,
  billing,
  selectedPromotionId,
  onPromotionChange,
  onAdjustQuantity,
  onUpdateQuantity,
  onRemoveLine,
  onContinue,
  continueLabel,
  emptyHint,
  className = "",
  embedded = false,
}: SaleCartPanelProps) {
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (embedded) {
    return (
      <div
        className={`rounded-lg border border-emerald-800/45 bg-[#1a221f] ${className}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-black/80 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingCart className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <span className="text-xs font-black uppercase text-slate-400">Carrito</span>
            <span className="truncate text-xs font-bold text-slate-500">
              {itemCount
                ? `${itemCount} producto${itemCount === 1 ? "" : "s"}`
                : "Vacío"}
            </span>
          </div>
          {billing && itemCount ? (
            <span className="shrink-0 text-sm font-black tabular-nums text-emerald-300">
              {billing.quotedTotal}
            </span>
          ) : null}
        </div>
        <div className="max-h-[min(40vh,16rem)] overflow-y-auto p-2 sm:p-2.5">
          <CartContents
            lines={lines}
            billing={billing}
            selectedPromotionId={selectedPromotionId}
            onPromotionChange={onPromotionChange}
            onAdjustQuantity={onAdjustQuantity}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveLine={onRemoveLine}
            onContinue={onContinue}
            continueLabel={continueLabel}
            emptyHint={emptyHint}
          />
        </div>
      </div>
    );
  }

  return (
    <aside
      className={`rounded-xl border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-black px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-emerald-400/15 text-emerald-300">
          <ShoppingCart className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#f8fafc]">Carrito</p>
          <p className="text-xs font-bold text-slate-400">
            {itemCount
              ? `${itemCount} producto${itemCount === 1 ? "" : "s"}`
              : "Vacío"}
          </p>
        </div>
        {billing && itemCount ? (
          <span className="shrink-0 text-base font-black tabular-nums text-emerald-300">
            {billing.quotedTotal}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <CartContents
          lines={lines}
          billing={billing}
          selectedPromotionId={selectedPromotionId}
          onPromotionChange={onPromotionChange}
          onAdjustQuantity={onAdjustQuantity}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveLine={onRemoveLine}
          onContinue={onContinue}
          continueLabel={continueLabel}
          emptyHint={emptyHint}
        />
      </div>
    </aside>
  );
}

type SaleCartDrawerProps = SaleCartPanelProps & {
  open: boolean;
  onClose: () => void;
};

export function SaleCartDrawer({
  open,
  onClose,
  ...panelProps
}: SaleCartDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const itemCount = panelProps.lines.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Cerrar carrito"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-black bg-[#1a221f] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-emerald-400/15 text-emerald-300">
              <ShoppingCart className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-slate-500">Carrito</p>
              <h2 className="text-xl font-black text-[#f8fafc]">
                {itemCount
                  ? `${itemCount} producto${itemCount === 1 ? "" : "s"}`
                  : "Vacío"}
              </h2>
              {panelProps.billing && itemCount ? (
                <p className="mt-1 text-sm font-black tabular-nums text-emerald-300">
                  {panelProps.billing.quotedTotal}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <CartContents {...panelProps} />
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/** Columna lateral: carrito fijo junto al paso activo (escritorio). */
export function SaleCartRail({
  children,
  cart,
  mobileTrigger,
}: {
  children: React.ReactNode;
  cart: React.ReactNode;
  mobileTrigger?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 space-y-3">
        {mobileTrigger ? <div className="xl:hidden">{mobileTrigger}</div> : null}
        {children}
      </div>
      <aside className="hidden xl:block xl:w-[19rem] xl:shrink-0">
        <div className="sticky top-2">{cart}</div>
      </aside>
    </div>
  );
}

export function SaleCartMobileChip({
  itemCount,
  total,
  onClick,
}: {
  itemCount: number;
  total: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-black bg-surface-card px-3 py-2.5 text-left transition hover:bg-surface-card-hover"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-emerald-400/15 text-emerald-300">
        <ShoppingCart className="h-4 w-4" aria-hidden />
        {itemCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black bg-emerald-400 px-0.5 text-[9px] font-black text-slate-950">
            {itemCount}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase text-slate-500">Carrito</span>
        <span className="block truncate text-sm font-black text-[#f8fafc]">
          {itemCount
            ? `${itemCount} producto${itemCount === 1 ? "" : "s"}`
            : "Vacío — toca para ver"}
        </span>
      </span>
      {total && itemCount ? (
        <span className="shrink-0 text-sm font-black tabular-nums text-emerald-300">
          {total}
        </span>
      ) : null}
    </button>
  );
}

/** @deprecated Use SaleCartRail */
export function SaleCartBottomBar({
  itemCount,
  total,
  open,
  onClick,
  onContinue,
  continueLabel = "Continuar",
}: {
  itemCount: number;
  total: string | null;
  open: boolean;
  onClick: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-30 -mx-1 mt-4 border-t border-black bg-[#1a221f]/96 px-1 py-2 backdrop-blur-sm sm:-mx-0 sm:px-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          aria-expanded={open}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
            open
              ? "border-emerald-600 bg-emerald-400/15"
              : itemCount
                ? "border-emerald-800/60 bg-[#1c2822] hover:border-emerald-700/70"
                : "border-black bg-surface-card hover:bg-surface-card-hover"
          }`}
        >
          <span
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              itemCount
                ? "border-emerald-700/50 bg-emerald-400/15 text-emerald-300"
                : "border-black bg-surface-inset text-slate-500"
            }`}
          >
            <ShoppingCart className="h-5 w-5" aria-hidden />
            {itemCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-emerald-400 px-1 text-[10px] font-black text-slate-950">
                {itemCount}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-black uppercase tracking-wide text-slate-500">
              Carrito
            </span>
            <span className="block truncate text-sm font-black text-[#f8fafc]">
              {itemCount
                ? `${itemCount} producto${itemCount === 1 ? "" : "s"}`
                : "Vacío"}
            </span>
          </span>
          {total && itemCount ? (
            <span className="shrink-0 text-base font-black tabular-nums text-emerald-300">
              {total}
            </span>
          ) : null}
        </button>
        {onContinue && itemCount > 0 ? (
          <button
            type="button"
            onClick={onContinue}
            className={`${primaryButtonClass} h-11 shrink-0 px-4 text-sm`}
          >
            {continueLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Use SaleCartBottomBar */
export function SaleCartDock({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-4 z-[130] lg:bottom-auto lg:top-5 lg:right-5">
      <div className="pointer-events-auto">{children}</div>
    </div>,
    document.body,
  );
}

type SaleCartIconButtonProps = {
  itemCount: number;
  total: string | null;
  open: boolean;
  onClick: () => void;
  compact?: boolean;
};

export function SaleStepCartTrigger({
  itemCount,
  total,
  open,
  onClick,
}: SaleCartIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={
        itemCount
          ? `Carrito, ${itemCount} producto${itemCount === 1 ? "" : "s"}${total ? `, ${total}` : ""}`
          : "Abrir carrito"
      }
      className={`group flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:gap-2.5 sm:px-2.5 sm:py-2 ${
        open
          ? "border-emerald-500/70 bg-emerald-400/15 shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]"
          : itemCount
            ? "border-emerald-800/55 bg-[#152019] hover:border-emerald-700/60 hover:bg-[#1a2820]"
            : "border-black/70 bg-black/20 hover:border-black hover:bg-black/30"
      }`}
    >
      <span
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition sm:h-9 sm:w-9 ${
          open
            ? "border-emerald-600 bg-emerald-400 text-slate-950"
            : itemCount
              ? "border-emerald-800/60 bg-emerald-400/15 text-emerald-300"
              : "border-black/80 bg-surface-card/80 text-slate-400 group-hover:text-slate-200"
        }`}
      >
        <ShoppingCart className="h-4 w-4" aria-hidden />
        {itemCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black bg-emerald-400 px-0.5 text-[9px] font-black text-slate-950">
            {itemCount}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500 sm:text-[10px]">
          Carrito
        </span>
        <span
          className={`block truncate text-[10px] font-black sm:text-[11px] ${
            itemCount ? "text-emerald-100" : "text-slate-400"
          }`}
        >
          {itemCount
            ? `${itemCount} producto${itemCount === 1 ? "" : "s"}`
            : "Ver carrito"}
        </span>
      </span>
      {total && itemCount ? (
        <span className="shrink-0 text-xs font-black tabular-nums text-emerald-300 sm:text-sm">
          {total}
        </span>
      ) : null}
      <ChevronDown
        className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform sm:h-4 sm:w-4 ${
          open ? "rotate-180 text-emerald-300" : ""
        }`}
        aria-hidden
      />
    </button>
  );
}

export function SaleCartIconButton({
  itemCount,
  total,
  open,
  onClick,
  compact = false,
}: SaleCartIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={
        itemCount
          ? `Carrito, ${itemCount} producto${itemCount === 1 ? "" : "s"}${total ? `, ${total}` : ""}`
          : "Carrito vacío"
      }
      title={total ? `Carrito · ${total}` : "Carrito"}
      className={`relative flex shrink-0 items-center justify-center border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
        compact
          ? "h-9 w-9 rounded-lg"
          : "h-12 w-12 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      } ${
        open
          ? "border-emerald-600 bg-emerald-400 text-slate-950 shadow-[0_8px_20px_rgba(16,185,129,0.28)]"
          : itemCount
            ? "border-emerald-700/50 bg-[#1c2822] text-emerald-300 hover:border-emerald-600/60 hover:bg-[#243029]"
            : "border-black bg-surface-card text-slate-400 hover:border-black hover:bg-surface-card-hover hover:text-slate-200"
      }`}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden />
      {itemCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-emerald-400 px-1 text-[10px] font-black text-slate-950">
          {itemCount}
        </span>
      ) : null}
    </button>
  );
}

/** @deprecated Use SaleCartDrawer */
export const SaleCartMobileDrawer = SaleCartDrawer;

/** @deprecated Use SaleCartIconButton */
export const SaleCartFloatingTrigger = SaleCartIconButton;
