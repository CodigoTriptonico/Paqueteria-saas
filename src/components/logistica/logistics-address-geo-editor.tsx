"use client";

import { useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import {
  patchLogisticsTaskAddressGeoAction,
  type LogisticsTaskGeoPatchInput,
} from "@/app/actions/logistics-routes";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

type AddressSuggestion = {
  description: string;
  placeId: string;
};

type ValidatedAddress = NonNullable<LogisticsTaskGeoPatchInput> & {
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type LogisticsAddressGeoEditorProps = {
  open: boolean;
  taskId: string;
  shipmentCode: string;
  initialQuery?: string;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
};

export function LogisticsAddressGeoEditor({
  open,
  taskId,
  shipmentCode,
  initialQuery = "",
  onCancel,
  onSaved,
}: LogisticsAddressGeoEditorProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [validated, setValidated] = useState<ValidatedAddress | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return null;
  }

  async function searchAddresses() {
    setError("");
    setSearching(true);
    setSuggestions([]);
    setValidated(null);

    try {
      const response = await fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "suggest",
          query,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        suggestions?: AddressSuggestion[];
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error || "No se pudo buscar direccion");
        return;
      }

      setSuggestions(data.suggestions || []);
    } catch {
      setError("No se pudo conectar con Google");
    } finally {
      setSearching(false);
    }
  }

  async function selectSuggestion(suggestion: AddressSuggestion) {
    setError("");
    setSearching(true);

    try {
      const response = await fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "details",
          placeId: suggestion.placeId,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        address?: {
          street?: string;
          houseNumber?: string;
          neighborhood?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
          formattedAddress?: string;
          placeId?: string;
          lat?: number | null;
          lng?: number | null;
        };
      };

      if (!response.ok || !data.ok || !data.address) {
        setError(data.error || "No se pudo validar direccion");
        return;
      }

      if (data.address.lat == null || data.address.lng == null) {
        setError("La direccion no tiene coordenadas");
        return;
      }

      setValidated({
        taskId,
        placeId: data.address.placeId || suggestion.placeId,
        formattedAddress: data.address.formattedAddress || suggestion.description,
        lat: data.address.lat,
        lng: data.address.lng,
        street: data.address.street,
        houseNumber: data.address.houseNumber,
        neighborhood: data.address.neighborhood,
        city: data.address.city,
        state: data.address.state,
        postalCode: data.address.postalCode,
        country: data.address.country,
      });
      setSuggestions([]);
      setQuery(data.address.formattedAddress || suggestion.description);
    } catch {
      setError("No se pudo conectar con Google");
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (!validated) {
      setError("Selecciona una direccion validada");
      return;
    }

    setSaving(true);
    const result = await patchLogisticsTaskAddressGeoAction(validated);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-black bg-surface-panel p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistics-geo-editor-title"
      >
        <p id="logistics-geo-editor-title" className="text-xl font-black text-[#f8fafc]">
          Corregir direccion
        </p>
        <p className="mt-1 text-sm font-bold text-slate-400">{shipmentCode}</p>

        <div className="mt-4 grid gap-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar direccion"
                className="h-11 w-full rounded-lg border border-black bg-surface-inset pl-10 pr-3 text-sm font-bold text-[#f8fafc] outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <button
              type="button"
              className={`${secondaryButtonClass} h-11 px-3`}
              disabled={searching || !query.trim()}
              onClick={() => void searchAddresses()}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </button>
          </div>

          {suggestions.length ? (
            <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-black bg-surface-card p-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion.placeId}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-sm font-bold text-slate-200 hover:bg-surface-inset"
                    onClick={() => void selectSuggestion(suggestion)}
                  >
                    {suggestion.description}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {validated ? (
            <p className="inline-flex items-start gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-sm font-bold text-emerald-100">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {validated.formattedAddress}
            </p>
          ) : null}

          {error ? <p className="text-sm font-black text-rose-300">{error}</p> : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !validated}
            className={`${primaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
          >
            {saving ? "Guardando…" : "Guardar geo"}
          </button>
        </div>
      </div>
    </div>
  );
}
