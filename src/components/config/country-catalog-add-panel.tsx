"use client";

import { Check, Plus, Search } from "lucide-react";
import { useMemo } from "react";
import { inputClass } from "@/components/ui-blocks";
import type { InventoryCatalogProduct } from "@/lib/pricing-catalog";

type CountryCatalogAddPanelProps = {
  products: InventoryCatalogProduct[];
  assignedCatalogKeys: Set<string>;
  query: string;
  onQueryChange: (query: string) => void;
  onAdd: (product: InventoryCatalogProduct) => void;
};

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function CountryCatalogAddPanel({
  products,
  assignedCatalogKeys,
  query,
  onQueryChange,
  onAdd,
}: CountryCatalogAddPanelProps) {
  const filteredProducts = useMemo(() => {
    const search = normalizeSearch(query);

    if (!search) {
      return products;
    }

    return products.filter(
      (product) =>
        product.label.toLowerCase().includes(search) ||
        product.path.toLowerCase().includes(search),
    );
  }, [products, query]);

  return (
    <div className="grid gap-2">
      <label className="relative block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          className={`${inputClass} h-10 w-full pl-9`}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filtrar por nombre o categoría…"
          aria-label="Filtrar catálogo"
        />
      </label>

      <ul className="max-h-56 overflow-y-auto rounded-lg border border-black bg-surface-inset">
        {filteredProducts.length ? (
          filteredProducts.map((product) => {
            const added = assignedCatalogKeys.has(product.catalogKey);

            return (
              <li
                key={product.catalogKey}
                className="flex items-center gap-2.5 border-b border-black/50 px-2 py-2 last:border-b-0"
              >
                <button
                  type="button"
                  disabled={added}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAdd(product);
                  }}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                    added
                      ? "border-emerald-600 bg-emerald-400 text-slate-950"
                      : "border-black bg-surface-card text-slate-400 hover:border-emerald-600/50 hover:bg-emerald-950/30 hover:text-emerald-300"
                  }`}
                  aria-label={
                    added ? `${product.label} ya agregado` : `Agregar ${product.label}`
                  }
                  title={added ? "Ya agregado" : "Agregar"}
                >
                  {added ? (
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-black ${
                      added ? "text-slate-500" : "text-[#f8fafc]"
                    }`}
                  >
                    {product.label}
                  </p>
                  <p className="truncate text-xs font-bold text-slate-500">{product.path}</p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="px-3 py-6 text-center text-sm font-bold text-slate-500">
            Sin coincidencias
          </li>
        )}
      </ul>
    </div>
  );
}
