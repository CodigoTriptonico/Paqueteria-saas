"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, MapPin, Phone, Plus, Trash2, UserPlus } from "lucide-react";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";
import { EmailDomainSuggestionsInput } from "@/components/email-domain-suggestions-input";
import { PhoneCountryInput } from "@/components/phone-country-input";
import { flowFormStackClass } from "@/components/flow-form-styles";
import { SaleAddressGooglePanel } from "@/components/sale/sale-address-google-panel";
import {
  type AddressSuggestion,
  type AddressValidation,
  clientFormInputClass,
  clientFormAddressFieldClass,
  clientFormAddressLabelClass,
  clientFormLabelClass,
  noBrowserAutocomplete,
  personFullName,
  type Sender,
} from "@/components/sale/venta-parts";
import { resolveAddressValidationUi, addressCardSubtitle } from "@/lib/sale-address-validation-ui";

type SaleClientFormProps = {
  form: {
    firstName: string;
    lastName: string;
    phones: string[];
    phoneList: string[];
    emails: string[];
    street: string;
    house: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    setFirstName: (value: string) => void;
    setLastName: (value: string) => void;
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
    searching?: boolean;
    validation: AddressValidation;
    setSearch: (value: string) => void;
    setSuggestions: (suggestions: AddressSuggestion[]) => void;
    setValidation: (validation: AddressValidation) => void;
    onSelectSuggestion: (suggestion: AddressSuggestion) => void | Promise<void>;
    touchField: (update: () => void) => void;
  };
  actions: {
    onCancel: () => void;
    onSubmit: (options?: { skipAddressVerification?: boolean }) => void;
    onAddEmail: () => void;
    onUpdateEmail: (index: number, value: string) => void;
    onRemoveEmail: (index: number) => void;
    onAddPhone: () => void;
    onUpdatePhone: (index: number, value: string) => void;
    onRemovePhone: (index: number) => void;
  };
  meta: {
    editingCustomerId: string | null;
    duplicateClient: Sender | null;
  };
};

export function SaleClientForm({ form, address, actions, meta }: SaleClientFormProps) {
  const contactMenuRef = useRef<HTMLDivElement>(null);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [addressUnverifiedAccepted, setAddressUnverifiedAccepted] = useState(false);
  const [showUnverifiedConfirm, setShowUnverifiedConfirm] = useState(false);
  const hasRequiredAddress =
    form.street.trim() && form.city.trim() && form.state.trim() && form.postalCode.trim();
  const addressReady = address.validation.status === "valid" || addressUnverifiedAccepted;
  const saveDisabled =
    !form.phoneList.length ||
    (!meta.duplicateClient &&
      (!form.firstName.trim() ||
        !form.lastName.trim() ||
        !hasRequiredAddress ||
        !addressReady));
  const fullAddress = [
    [form.street, form.house].filter(Boolean).join(" "),
    [form.city, form.state, form.postalCode].filter(Boolean).join(" "),
    "USA",
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    if (!contactMenuOpen) {
      return;
    }

    function closeFromOutside(event: PointerEvent) {
      if (!contactMenuRef.current?.contains(event.target as Node)) {
        setContactMenuOpen(false);
      }
    }

    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContactMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [contactMenuOpen]);

  function addEmailContact() {
    actions.onAddEmail();
    setContactMenuOpen(false);
  }

  function addPhoneContact() {
    actions.onAddPhone();
    setContactMenuOpen(false);
  }

  function touchAddressField(update: () => void) {
    setAddressUnverifiedAccepted(false);
    address.touchField(update);
  }

  function selectSuggestedAddress(suggestion: AddressSuggestion) {
    setAddressUnverifiedAccepted(false);
    void address.onSelectSuggestion(suggestion);
  }

  function useAddressWithoutGoogle() {
    setAddressUnverifiedAccepted(true);
    setShowUnverifiedConfirm(false);
    address.setSuggestions([]);
    address.setValidation({
      status: "idle",
      message: "Direccion sin verificar",
    });
  }

  const addressUi = resolveAddressValidationUi({
    enabled: true,
    searching: address.searching,
    validation: address.validation,
    suggestionsCount: address.suggestions.length,
    unverifiedAccepted: addressUnverifiedAccepted,
    hasRequiredAddress: Boolean(hasRequiredAddress),
    fullAddress,
  });

  return (
    <>
      <div className="mb-5 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-start gap-2">
          <button
            type="button"
            onClick={actions.onCancel}
            className="h-10 rounded-md border border-slate-600/60 bg-surface-inset px-4 text-sm font-black text-[#f8fafc]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              actions.onSubmit(
                addressUnverifiedAccepted ? { skipAddressVerification: true } : undefined,
              )
            }
            disabled={saveDisabled}
            className="h-10 rounded-md bg-emerald-400 px-5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {meta.editingCustomerId ? "Guardar" : meta.duplicateClient ? "Usar existente" : "Crear remitente"}
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
              <p className="text-sm font-black uppercase text-[#f8fafc]">Remitente</p>
              <p className="text-xs font-bold text-slate-400">Nombre, correo y telefonos</p>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className={`${flowFormStackClass} max-w-none`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={clientFormLabelClass}>Nombre</span>
                  <input
                    {...noBrowserAutocomplete}
                    name="boxario-client-first-name"
                    className={clientFormInputClass}
                    placeholder="Carlos"
                    value={form.firstName}
                    onChange={(event) => form.setFirstName(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={clientFormLabelClass}>Apellido</span>
                  <input
                    {...noBrowserAutocomplete}
                    name="boxario-client-last-name"
                    className={clientFormInputClass}
                    placeholder="Diaz"
                    value={form.lastName}
                    onChange={(event) => form.setLastName(event.target.value)}
                  />
                </label>
              </div>

              <div ref={contactMenuRef} className="relative flex w-fit items-center justify-start gap-2">
                <button
                  type="button"
                  title="Agregar contacto"
                  aria-label="Agregar contacto"
                  aria-expanded={contactMenuOpen}
                  onClick={() => setContactMenuOpen((open) => !open)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-slate-950"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className={clientFormLabelClass}>Contacto</span>
                {contactMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-40 overflow-hidden rounded-lg border border-black bg-[#101820] shadow-2xl">
                    <button
                      type="button"
                      onClick={addEmailContact}
                      className="flex h-10 w-full items-center gap-2 border-b border-black px-3 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-header"
                    >
                      <Mail className="h-4 w-4 text-emerald-300" />
                      Correo
                    </button>
                    <button
                      type="button"
                      onClick={addPhoneContact}
                      className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-header"
                    >
                      <Phone className="h-4 w-4 text-emerald-300" />
                      Telefono
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <span className={clientFormLabelClass}>Correos</span>
                {form.emails.map((email, index) => (
                  <div key={`client-email-${index}`} className="flex items-start gap-2">
                    <EmailDomainSuggestionsInput
                      {...noBrowserAutocomplete}
                      className="min-w-0 flex-1"
                      name={`boxario-client-email-${index}`}
                      inputClassName={`${clientFormInputClass} pl-10`}
                      placeholder="cliente@correo.com"
                      value={email}
                      onChange={(value) => actions.onUpdateEmail(index, value)}
                      icon={<Mail className="h-4 w-4" />}
                    />
                    <button
                      type="button"
                      title="Quitar correo"
                      aria-label="Quitar correo"
                      disabled={form.emails.length === 1}
                      onClick={() => actions.onRemoveEmail(index)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-[#3A1818] text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <span className={clientFormLabelClass}>Telefonos</span>
                {form.phones.map((phone, index) => (
                  <div key={`client-phone-${index}`} className="flex flex-wrap items-start gap-2">
                    <PhoneCountryInput
                      className="min-w-0 flex-1"
                      name={`boxario-client-phone-${index}`}
                      value={phone}
                      onChange={(value) => actions.onUpdatePhone(index, value)}
                    />
                    <button
                      type="button"
                      title="Quitar telefono"
                      aria-label="Quitar telefono"
                      disabled={form.phones.length === 1}
                      onClick={() => actions.onRemovePhone(index)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-[#3A1818] text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {meta.duplicateClient ? (
                <div className="rounded-lg border border-amber-600 bg-amber-400 px-3 py-2.5 text-slate-950">
                  <p className="text-xs font-black uppercase text-amber-200">Telefono ya registrado</p>
                  <p className="truncate text-sm font-black text-[#f8fafc]">
                    {personFullName(meta.duplicateClient)}
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
              <p className="text-sm font-black uppercase text-[#f8fafc]">Direccion USA</p>
              <p className="text-xs font-bold text-slate-400">
                {addressCardSubtitle(addressUi.tone)}
              </p>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_6.5rem_5.5rem]">
              <label className="grid min-w-0 gap-1.5">
                <span className={clientFormAddressLabelClass(form.street)}>Calle</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-client-line-1"
                  className={clientFormAddressFieldClass(form.street)}
                  placeholder="Calle y numero"
                  value={form.street}
                  onChange={(event) => {
                    touchAddressField(() => form.setStreet(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={clientFormAddressLabelClass(form.house, { required: false })}>
                  Unidad
                </span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-client-line-2"
                  className={clientFormAddressFieldClass(form.house, { required: false })}
                  placeholder="Apto / suite"
                  value={form.house}
                  onChange={(event) => {
                    touchAddressField(() => form.setHouse(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={clientFormAddressLabelClass(form.postalCode)}>CP</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-client-zip"
                  className={clientFormAddressFieldClass(form.postalCode)}
                  placeholder="Codigo postal"
                  value={form.postalCode}
                  onChange={(event) => {
                    touchAddressField(() => form.setPostalCode(event.target.value));
                  }}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem]">
              <label className="grid min-w-0 gap-1.5">
                <span className={clientFormAddressLabelClass(form.neighborhood, { required: false })}>
                  Colonia
                </span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-client-zone"
                  className={clientFormAddressFieldClass(form.neighborhood, { required: false })}
                  placeholder="Barrio / colonia"
                  value={form.neighborhood}
                  onChange={(event) => {
                    touchAddressField(() => form.setNeighborhood(event.target.value));
                  }}
                />
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className={clientFormAddressLabelClass(form.city)}>Ciudad</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-client-city"
                  className={clientFormAddressFieldClass(form.city)}
                  placeholder="Ciudad"
                  value={form.city}
                  onChange={(event) => {
                    touchAddressField(() => form.setCity(event.target.value));
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className={clientFormAddressLabelClass(form.state)}>Estado</span>
                <input
                  {...noBrowserAutocomplete}
                  name="boxario-client-region"
                  className={clientFormAddressFieldClass(form.state)}
                  placeholder="Estado"
                  value={form.state}
                  onChange={(event) => {
                    touchAddressField(() => form.setState(event.target.value));
                  }}
                />
              </label>
            </div>

            <SaleAddressGooglePanel
              validation={address.validation}
              searching={address.searching}
              suggestions={address.suggestions}
              unverifiedAccepted={addressUnverifiedAccepted}
              hasRequiredAddress={Boolean(hasRequiredAddress)}
              fullAddress={fullAddress}
              listboxId="client-address-suggestions-listbox"
              onSelectSuggestion={selectSuggestedAddress}
              onUseUnverified={() => setShowUnverifiedConfirm(true)}
            />
          </div>
        </div>
      </form>

      <ActionConfirmDialog
        open={showUnverifiedConfirm}
        dialogId="client-unverified-address-confirm"
        title="Direccion sin verificar"
        message="Estas seguro de que quieres agregar esta direccion sin verificarla en Google? Puede tener errores y afectar la entrega."
        confirmLabel="Agregar sin verificar"
        cancelLabel="Volver"
        tone="warning"
        onCancel={() => setShowUnverifiedConfirm(false)}
        onConfirm={useAddressWithoutGoogle}
      />
    </>
  );
}
