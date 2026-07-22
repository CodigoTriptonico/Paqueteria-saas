"use client";

import { X } from "lucide-react";
import { CountryFlag } from "@/components/country-flag";
import { personFullName, type Sender } from "@/components/sale/venta-parts";

type SaleQuickCountryPickerProps = {
  sender: Sender;
  countries: string[];
  onClose: () => void;
  onSelect: (country: string) => void;
};

export function SaleQuickCountryPicker({
  sender,
  countries,
  onClose,
  onSelect,
}: SaleQuickCountryPickerProps) {
  return (
    <div className="app-modal-overlay fixed inset-0 z-[120] flex justify-center bg-black/60 p-3 sm:p-4">
      <div
        className="app-modal-content w-full max-w-md rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-sale-country-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-black pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-500">Venta rápida</p>
            <h3 id="quick-sale-country-title" className="text-2xl font-black text-[#f8fafc]">
              ¿A qué país?
            </h3>
            <p className="mt-1 break-words text-sm font-bold text-slate-400">
              {personFullName(sender)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-black"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs font-bold leading-snug text-slate-400">
          Elige el catálogo de cajas vacías para esta venta.
        </p>

        <div className="mt-4 grid gap-2" role="group" aria-label="Países con cajas">
          {countries.map((country) => (
            <button
              key={country}
              type="button"
              onClick={() => onSelect(country)}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-black bg-surface-card px-4 text-left transition hover:border-emerald-400 hover:bg-emerald-400/10"
            >
              <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black bg-surface-inset">
                <CountryFlag name={country} size="md" className="h-full w-full rounded-none border-0" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-[#f8fafc]">{country}</span>
                <span className="mt-0.5 block text-xs font-bold text-slate-400">
                  Ver cajas de este país
                </span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-12 w-full rounded-lg border border-black font-black"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
