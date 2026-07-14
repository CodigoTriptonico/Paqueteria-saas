"use client";

import { Globe2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PricingCountryConfig } from "@/app/actions/pricing";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { CountryFlag } from "@/components/country-flag";
import { resolveCountryCode } from "@/lib/country-options";
import {
  productCountryAssignments,
  setProductCountryAssignments,
  type InventoryCatalogProduct,
  type ProductCountryAssignment,
} from "@/lib/pricing-catalog";

type ProductCountriesModalProps = {
  open: boolean;
  product: InventoryCatalogProduct | null;
  countries: PricingCountryConfig[];
  onClose: () => void;
  onSave: (nextCountries: PricingCountryConfig[]) => void;
};

export function ProductCountriesModal({
  open,
  product,
  countries,
  onClose,
  onSave,
}: ProductCountriesModalProps) {
  const [draft, setDraft] = useState<ProductCountryAssignment[]>([]);

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    queueMicrotask(() => {
      setDraft(productCountryAssignments(countries, product.catalogKey));
    });
  }, [countries, open, product]);

  const sortedDraft = useMemo(
    () =>
      [...draft].sort((left, right) =>
        left.countryName.localeCompare(right.countryName, "es"),
      ),
    [draft],
  );

  if (!open || !product) {
    return null;
  }

  function updateAssignment(
    countryName: string,
    patch: Partial<Pick<ProductCountryAssignment, "active" | "price">>,
  ) {
    setDraft((current) =>
      current.map((entry) =>
        entry.countryName === countryName ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function handleSave() {
    if (!product) {
      return;
    }

    onSave(setProductCountryAssignments(countries, product, draft));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-black bg-surface-panel shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-black px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Países y precio
            </p>
            <h2 className="mt-1 text-lg font-black text-[#f8fafc]">{product.label}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">{product.path}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-surface-card-hover hover:text-[#f8fafc]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[24rem] space-y-2 overflow-y-auto px-5 py-4">
          {sortedDraft.length ? (
            sortedDraft.map((entry) => {
              const country = countries.find((item) => item.name === entry.countryName);
              const code = resolveCountryCode(
                country || { code: "", name: entry.countryName },
              );

              return (
                <div
                  key={entry.countryName}
                  className="flex items-center gap-3 rounded-lg border border-black bg-surface-card px-3 py-2"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={entry.active}
                      onChange={(event) =>
                        updateAssignment(entry.countryName, { active: event.target.checked })
                      }
                      className="h-4 w-4 accent-emerald-400"
                    />
                    <CountryFlag code={code} size="sm" />
                    <span className="truncate text-sm font-black text-[#f8fafc]">
                      {entry.countryName}
                    </span>
                  </label>
                  <input
                    className={`${inputClass} h-10 w-24 text-center text-sm font-black`}
                    value={entry.price.replace("$", "")}
                    disabled={!entry.active}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/[^\d.]/g, "");
                      updateAssignment(entry.countryName, {
                        price: digits ? `$${digits}` : "$0",
                      });
                    }}
                    aria-label={`Precio para ${entry.countryName}`}
                  />
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-600/60 px-4 py-8 text-center">
              <Globe2 className="mx-auto h-8 w-8 text-slate-500" aria-hidden />
              <p className="mt-3 text-sm font-bold text-slate-400">
                Agrega países en Configuración para asignar este producto.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-black px-5 py-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className={primaryButtonClass}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
