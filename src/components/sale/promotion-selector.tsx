"use client";

import { Tags } from "lucide-react";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import type { PromotionQuote } from "@/lib/pricing-promotions";

type PromotionSelectorProps = {
  candidates: PromotionQuote[];
  selectedPromotionId: string;
  onChange: (promotionId: string) => void;
  className?: string;
};

export function PromotionSelector({
  candidates,
  selectedPromotionId,
  onChange,
  className = "",
}: PromotionSelectorProps) {
  if (candidates.length <= 1) {
    return null;
  }

  const selected = candidates.find((quote) => quote.promotionId === selectedPromotionId);
  const options = candidates.map((quote) => ({
    value: quote.promotionId,
    label: quote.name,
    searchText: quote.description,
    icon: <Tags className="h-3.5 w-3.5 text-emerald-300" />,
    trailing: (
      <span className="rounded-md border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black tabular-nums text-emerald-300">
        -{quote.discountTotal}
      </span>
    ),
  }));

  return (
    <div className={`grid gap-2 rounded-lg border border-black bg-[#1a2320] p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase text-slate-500">Promocion</p>
        {selected ? (
          <span className="text-[10px] font-black uppercase text-emerald-300">
            Ahorra {selected.discountTotal}
          </span>
        ) : null}
      </div>
      <InlineSearchPicker
        options={options}
        value={selectedPromotionId}
        onChange={onChange}
        placeholder="Elegir promocion"
        searchPlaceholder="Buscar promocion..."
        emptyLabel="Sin promociones"
        ariaLabel="Elegir promocion"
        className="w-full"
        minWidthClass="w-full min-w-0"
        shellClassName="inset-shell box-border inline-flex h-11 w-full max-w-full items-center gap-2 rounded-lg border border-solid border-black bg-[#111827] px-3"
        formatSelectedLabel={(option, placeholder) => option?.label || placeholder}
      />
      <p className="min-h-4 text-xs font-bold text-slate-500">
        {selected?.description || "Varias promociones aplican a esta cantidad."}
      </p>
    </div>
  );
}
