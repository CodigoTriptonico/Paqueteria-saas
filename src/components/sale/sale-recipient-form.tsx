"use client";

import { PhoneCountryInput } from "@/components/phone-country-input";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { flowFormStackClass, flowIntroClass } from "@/components/flow-form-styles";
import { MapPin, UserPlus } from "lucide-react";
import {
  type AddressSuggestion,
  type AddressValidation,
  clientFormInputClass,
  clientFormLabelClass,
  noBrowserAutocomplete,
  type Recipient,
} from "@/components/sale/venta-parts";

type SaleRecipientFormProps = {
  form: {
    firstName: string;
    lastName: string;
    phone: string;
    country: string;
    street: string;
    house: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    setFirstName: (value: string) => void;
    setLastName: (value: string) => void;
    setPhone: (value: string) => void;
    setCountry: (value: string) => void;
    setStreet: (value: string) => void;
    setHouse: (value: string) => void;
    setNeighborhood: (value: string) => void;
    setCity: (value: string) => void;
    setState: (value: string) => void;
    setPostalCode: (value: string) => void;
  };
  address: {
    search: string;
    suggestions: AddressSuggestion[];
    validation: AddressValidation;
    setSearch: (value: string) => void;
    setSuggestions: (suggestions: AddressSuggestion[]) => void;
    setValidation: (validation: AddressValidation) => void;
    onSelectSuggestion: (suggestion: AddressSuggestion) => void | Promise<void>;
    touchField: (update: () => void) => void;
  };
  actions: {
    onCancel: () => void;
    onSubmit: () => void;
  };
  meta: {
    countries: string[];
    duplicateRecipient: Recipient | null;
  };
};

export function SaleRecipientForm({ form, address, actions, meta }: SaleRecipientFormProps) {
  const saveDisabled =
    !form.firstName.trim() ||
    !form.lastName.trim() ||
    !form.phone.trim() ||
    !form.country ||
    (!meta.duplicateRecipient && address.validation.status !== "valid");
  const fullAddress = [
    [form.street, form.house].filter(Boolean).join(" "),
    [form.city, form.state, form.postalCode].filter(Boolean).join(" "),
    form.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <p className={`${flowIntroClass} !text-left !text-slate-300`}>
            Registra un nuevo destinatario.
          </p>
          <span
            className={`rounded-lg border px-3 py-1 text-xs font-black uppercase ${
              address.validation.status === "valid"
                ? "border-black bg-surface-inset text-slate-200"
                : address.validation.status === "invalid"
                  ? "border-amber-600 bg-amber-400 text-slate-950"
                  : "border-black bg-surface-card text-slate-300"
            }`}
          >
            {address.validation.status === "valid"
              ? "Google OK"
              : address.validation.status === "invalid" && address.validation.message
                ? "Error direccion"
                : "Sin validar"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={actions.onCancel}
            className="h-10 rounded-md border border-slate-600/60 bg-surface-inset px-4 text-sm font-black text-[#f8fafc]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={actions.onSubmit}
            disabled={saveDisabled}
            className="h-10 rounded-md bg-emerald-400 px-5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {meta.duplicateRecipient ? "Usar existente" : "Guardar destinatario"}
          </button>
        </div>
      </div>

      <form
        className="relative grid gap-4 lg:grid-cols-2 lg:items-start"
        autoComplete="off"
        onSubmit={(event) => event.preventDefault()}
      >
        <div
          className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
          aria-hidden
        >
          <input tabIndex={-1} name="fake-street" autoComplete="street-address" readOnly />
          <input tabIndex={-1} name="fake-city" autoComplete="address-level2" readOnly />
        </div>

        <div className="flex flex-col self-start overflow-visible rounded-lg border border-black bg-surface-card">
          <div className="flex items-center gap-3 border-b border-emerald-400/25 bg-[#1f2c28] px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-[#f8fafc]">Destinatario</p>
              <p className="text-xs font-bold text-slate-400">Nombre, telefono y pais</p>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className={`${flowFormStackClass} max-w-none`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={clientFormLabelClass}>Nombre</span>
                  <input
                    {...noBrowserAutocomplete}
                    name="boxario-recipient-first-name"
                    className={clientFormInputClass}
                    placeholder="Maria"
                    value={form.firstName}
                    onChange={(event) => form.setFirstName(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={clientFormLabelClass}>Apellido</span>
                  <input
                    {...noBrowserAutocomplete}
                    name="boxario-recipient-last-name"
                    className={clientFormInputClass}
                    placeholder="Lopez"
                    value={form.lastName}
                    onChange={(event) => form.setLastName(event.target.value)}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className={clientFormLabelClass}>Telefono</span>
                <PhoneCountryInput
                  className="min-w-0"
                  name="boxario-recipient-phone"
                  value={form.phone}
                  onChange={form.setPhone}
                />
              </label>

              <label className="grid gap-1.5">
                <span className={clientFormLabelClass}>Pais obligatorio</span>
                <InlineSearchPicker
                  compact={false}
                  className="w-full"
                  minWidthClass="w-full min-w-0"
                  value={form.country}
                  onChange={(country) => {
                    form.setCountry(country);
                    address.setSuggestions([]);
                    address.setValidation({ status: "idle", message: "" });
                  }}
                  options={meta.countries.map((country) => ({
                    value: country,
                    label: country,
                  }))}
                  placeholder="Elegir pais"
                  searchPlaceholder="Buscar pais…"
                  ariaLabel="Pais del destinatario"
                />
              </label>

              {meta.duplicateRecipient ? (
                <div className="rounded-lg border border-amber-600 bg-amber-400 px-3 py-2.5 text-slate-950">
                  <p className="text-xs font-black uppercase text-amber-200">Destinatario duplicado</p>
                  <p className="text-sm font-black text-[#f8fafc]">
                    Ese destinatario ya existe para este cliente.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex h-full min-w-0 flex-col rounded-lg border border-black bg-surface-card">
          <div className="flex items-center gap-3 border-b border-sky-300/25 bg-[#1f2c28] px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-300 text-slate-950">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-[#f8fafc]">Direccion destino</p>
              <p className="text-xs font-bold text-slate-400">Buscar y validar en Google</p>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_6.5rem_5.5rem]">
              <label className="grid min-w-0 gap-1.5">
                <span className={clientFormLabelClass}>Calle</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-recipient-line-1"
                  className={clientFormInputClass}
                  placeholder="Calle y numero"
                  value={form.street}
                  onChange={(event) => {
                    address.touchField(() => form.setStreet(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={clientFormLabelClass}>Unidad</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-recipient-line-2"
                  className={clientFormInputClass}
                  placeholder="Apto / suite"
                  value={form.house}
                  onChange={(event) => {
                    address.touchField(() => form.setHouse(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={clientFormLabelClass}>CP</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-recipient-zip"
                  className={clientFormInputClass}
                  placeholder="Codigo postal"
                  value={form.postalCode}
                  onChange={(event) => {
                    address.touchField(() => form.setPostalCode(event.target.value));
                  }}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem]">
              <label className="grid min-w-0 gap-1.5">
                <span className={clientFormLabelClass}>Colonia</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-recipient-zone"
                  className={clientFormInputClass}
                  placeholder="Barrio / colonia"
                  value={form.neighborhood}
                  onChange={(event) => {
                    address.touchField(() => form.setNeighborhood(event.target.value));
                  }}
                />
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className={clientFormLabelClass}>Ciudad</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-recipient-city"
                  className={clientFormInputClass}
                  placeholder="Ciudad"
                  value={form.city}
                  onChange={(event) => {
                    address.touchField(() => form.setCity(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={clientFormLabelClass}>Estado</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-recipient-region"
                  className={clientFormInputClass}
                  placeholder="Estado"
                  value={form.state}
                  onChange={(event) => {
                    address.touchField(() => form.setState(event.target.value));
                  }}
                />
              </label>
            </div>

            {address.suggestions.length ? (
              <div
                id="recipient-address-suggestions-listbox"
                role="listbox"
                className="overflow-hidden rounded-lg border border-black bg-[#101820]"
              >
                {address.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={() => void address.onSelectSuggestion(suggestion)}
                    className="grid w-full gap-0.5 border-b border-black px-4 py-3 text-left last:border-b-0 hover:bg-surface-card-header"
                  >
                    <span className="truncate text-sm font-black text-[#f8fafc]">
                      {suggestion.mainText}
                    </span>
                    <span className="truncate text-xs font-bold text-slate-300">
                      {[suggestion.secondaryText, suggestion.postalCode].filter(Boolean).join(" | CP ")}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <p
              className={`rounded-lg border px-3.5 py-2.5 text-sm font-bold leading-snug break-words ${
                address.validation.status === "valid"
                  ? "border-black bg-surface-inset text-slate-300"
                  : address.validation.status === "invalid"
                    ? "border-amber-600 bg-amber-400 text-slate-950"
                    : "border-black bg-surface-inset text-slate-500"
              }`}
            >
              {fullAddress ||
                address.validation.formattedAddress ||
                address.validation.message ||
                "Selecciona una direccion para validar"}
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
