import { ArrowLeft, Check, ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { Fragment } from "react";
import {
  flowStepBarPaddingClass,
  flowStepBarShellClass,
} from "@/components/flow-form-styles";
import { cardHoverClass, selectionActiveClass, selectionShellClass } from "@/components/ui-blocks";
import { CountryFlag } from "@/components/country-flag";
import type { InvoiceBillingSnapshot } from "@/lib/invoice-billing";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import type { SaleRecipient, SaleSender } from "@/lib/customers/mappers";
import { formatScheduleAtDisplay, scheduleTimeComplete } from "@/components/sale/schedule-time";

export function saleStepButtonClass(isActive: boolean, isUnlocked: boolean) {
  if (isActive) {
    return "border-emerald-600 bg-emerald-400 text-slate-950";
  }

  if (isUnlocked) {
    return "border-black bg-surface-card text-slate-300 hover:border-black hover:bg-surface-card-hover";
  }

  return "cursor-not-allowed border-black bg-surface-inset text-slate-500";
}

export function SaleBoxCartQtyBadge({ quantity }: { quantity: number }) {
  return (
    <span
      className="mt-2 inline-flex h-8 min-w-[2.75rem] items-center justify-center rounded-lg border border-amber-500/90 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 px-2.5 text-lg font-black leading-none tabular-nums tracking-tight text-slate-950 shadow-[0_6px_18px_rgba(251,146,60,0.42)] ring-1 ring-inset ring-amber-100/50"
      aria-label={`${quantity} en carrito`}
    >
      ×{quantity}
    </span>
  );
}

export { unselectedDimClass } from "@/components/ui-blocks";
export const selectedBorderClass = `${selectionShellClass} ${selectionActiveClass}`;

export function deliveryModeCardClass(selected: boolean) {
  if (selected) {
    return "relative overflow-hidden border-2 border-emerald-700 bg-emerald-600/40 shadow-[0_8px_24px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/50";
  }

  return `${cardHoverClass} border-2 border-black bg-[#3a4842] hover:bg-[#425048]`;
}

export function deliveryModeIconClass(selected: boolean) {
  return selected
    ? "border-emerald-800 bg-emerald-500 text-slate-950"
    : "border-black bg-[#2e3834] text-emerald-300";
}

export function deliverySegmentClass(selected: boolean) {
  return selected
    ? "bg-emerald-400 text-slate-950 shadow-sm"
    : "text-slate-400 hover:bg-surface-card/60 hover:text-slate-200";
}

export type PersonName = {
  firstName: string;
  lastName: string;
};

export type Recipient = SaleRecipient;
export type Sender = SaleSender;

export type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  firstName: string;
  lastName: string;
  type: "remitente" | "destinatario" | "caja";
  targetKey: string;
  customerId?: string;
  recipientId?: string;
  phones: string[];
  address: {
    street?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

export function emptyBoxOfficeSummary() {
  return "Caja vacia entregada en mostrador";
}

export function deliverySummary(
  action: string,
  scheduleMode: string,
  scheduleAt: string,
) {
  if (!action) {
    return "Pendiente";
  }

  if (action === EMPTY_BOX_OFFICE_MODE) {
    return emptyBoxOfficeSummary();
  }

  if (!action.includes("Programar")) {
    return action;
  }

  if (scheduleMode === "pending") {
    return `${action} - pendiente`;
  }

  if (scheduleMode !== "scheduled") {
    return `${action} - falta elegir`;
  }

  return scheduleAt ? `${action} - ${formatScheduleAtDisplay(scheduleAt)}` : `${action} - falta fecha`;
}

export const EMPTY_BOX_OFFICE_MODE = "Cliente recoge caja vacia en oficina";
export const EMPTY_BOX_DRIVER_MODE = "Programar entrega de caja vacia";
export const FULL_BOX_OFFICE_MODE = "Cliente trae caja llena a oficina";
export const FULL_BOX_DRIVER_MODE = "Programar recoleccion caja llena";
export const FULL_BOX_DEFERRED_SUMMARY = "Recolección pendiente";

export function fullBoxSummaryLine(
  fullBoxMode: string,
  fullBoxScheduleMode: string,
  fullBoxScheduleAt: string,
) {
  if (!fullBoxMode) {
    return FULL_BOX_DEFERRED_SUMMARY;
  }

  return deliverySummary(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);
}

export function saleLogisticsPlanReady(
  emptyBoxMode: string,
  emptyBoxScheduleMode: string,
  emptyBoxScheduleAt: string,
  fullBoxMode: string,
  fullBoxScheduleMode: string,
  fullBoxScheduleAt: string,
) {
  const emptyBoxComplete = logisticsLegComplete(
    emptyBoxMode,
    emptyBoxScheduleMode,
    emptyBoxScheduleAt,
  );

  if (!emptyBoxComplete) {
    return false;
  }

  if (!fullBoxMode) {
    return true;
  }

  return logisticsLegComplete(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);
}

export function saleLogisticsContinueHint(
  emptyBoxMode: string,
  emptyBoxScheduleMode: string,
  emptyBoxScheduleAt: string,
  fullBoxMode: string,
  fullBoxScheduleMode: string,
  fullBoxScheduleAt: string,
  fullBoxPickupExpanded: boolean,
) {
  if (
    saleLogisticsPlanReady(
      emptyBoxMode,
      emptyBoxScheduleMode,
      emptyBoxScheduleAt,
      fullBoxMode,
      fullBoxScheduleMode,
      fullBoxScheduleAt,
    )
  ) {
    return "";
  }

  const pickupDeferred = !fullBoxMode && !fullBoxPickupExpanded;
  const fullComplete = logisticsLegComplete(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);

  if (pickupDeferred) {
    return "Elige cómo sale la caja vacía. La recolección queda pendiente.";
  }

  if (fullBoxMode && !fullComplete) {
    return "Completa la recolección o toca Dejar pendiente.";
  }

  return "Elige cómo sale la caja vacía para continuar.";
}

export function scheduledModeComplete(scheduleMode: string, scheduleAt: string) {
  const routeDate = scheduleAt.split("T")[0] || "";
  const routeTime = scheduleAt.split("T")[1] || "";

  return scheduleMode === "pending" || (scheduleMode === "scheduled" && Boolean(routeDate && scheduleTimeComplete(routeTime)));
}

export function logisticsLegComplete(mode: string, scheduleMode: string, scheduleAt: string) {
  if (!mode) {
    return false;
  }

  if (mode === EMPTY_BOX_OFFICE_MODE || mode === FULL_BOX_OFFICE_MODE) {
    return true;
  }

  return scheduledModeComplete(scheduleMode, scheduleAt);
}

export function logisticsDriverTaskCount(emptyBoxMode: string, fullBoxMode: string) {
  return Number(emptyBoxMode === EMPTY_BOX_DRIVER_MODE) + Number(fullBoxMode === FULL_BOX_DRIVER_MODE);
}

export function logisticsSummary(
  emptyBoxMode: string,
  emptyBoxScheduleMode: string,
  emptyBoxScheduleAt: string,
  fullBoxMode: string,
  fullBoxScheduleMode: string,
  fullBoxScheduleAt: string,
  notes = "",
) {
  const parts = [
    `Caja vacia: ${deliverySummary(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt)}`,
    `Caja llena: ${fullBoxSummaryLine(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt)}`,
  ];
  const cleanNotes = notes.trim();

  if (cleanNotes) {
    parts.push(`Notas: ${cleanNotes}`);
  }

  return parts.join(" | ");
}

export type SaleStep = "client" | "recipient" | "box" | "delivery" | "finish";
export type AddressFormKind = "client" | "recipient";
export type AddressValidation = {
  status: "idle" | "checking" | "valid" | "invalid";
  message: string;
  formattedAddress?: string;
  placeId?: string;
  lat?: number | null;
  lng?: number | null;
};
export type AddressSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  postalCode?: string;
};

export function personFullName(person: PersonName) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

export type SalePersonAddress = {
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export function salePersonAddressLines(address: SalePersonAddress) {
  const streetLine = [address.street?.trim(), address.houseNumber?.trim()].filter(Boolean).join(" ");
  const cityLine = [
    address.city?.trim(),
    [address.state?.trim(), address.postalCode?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return [
    streetLine || undefined,
    address.neighborhood?.trim() || undefined,
    cityLine || undefined,
  ].filter((line): line is string => Boolean(line));
}

export function salePersonAddressSummary(address: SalePersonAddress) {
  return salePersonAddressLines(address).join(", ");
}

export function samePersonName(a: PersonName, b: PersonName) {
  return (
    a.firstName.trim().toLowerCase() === b.firstName.trim().toLowerCase() &&
    a.lastName.trim().toLowerCase() === b.lastName.trim().toLowerCase()
  );
}

export function recipientIdentityKey(recipient: Recipient) {
  if (recipient.id) {
    return recipient.id;
  }

  return `${recipient.firstName}|${recipient.lastName}|${recipient.country}`.toLowerCase();
}

export const RECIPIENTS_PER_PAGE = 3;
export const SENDERS_PER_PAGE = 3;
export const RECENT_SENDERS_PER_PAGE = 3;

export function historyDateLabel(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type SaleInvoicePaperProps = {
  invoiceNumber: string;
  sender: Sender;
  recipient?: Recipient | null;
  box: string[];
  deliveryLine: string;
  className?: string;
  lineAmount?: string;
  totalLabel?: string;
  totalAmount?: string;
  billing?: InvoiceBillingSnapshot | null;
  payNowDraft?: string;
  payNowDraftTouched?: boolean;
  onPayNowDraftChange?: (value: string) => void;
};

function invoiceBoxTitle(label: string) {
  return label.replace(/^Caja\s+/i, "").trim() || label;
}

function InvoicePartyCard({
  label,
  name,
  phone,
  addressLines,
  country,
}: {
  label: string;
  name: string;
  phone?: string;
  addressLines: string[];
  country?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3.5 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm font-bold leading-snug text-slate-900">{name}</p>
      {phone ? <p className="mt-1 text-[11px] leading-snug text-slate-700">{phone}</p> : null}
      {addressLines.map((line) => (
        <p key={line} className="mt-0.5 text-[11px] leading-snug text-slate-600">
          {line}
        </p>
      ))}
      {country ? <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-700">{country}</p> : null}
    </div>
  );
}

export function SaleInvoicePaper({
  invoiceNumber,
  sender,
  recipient,
  box,
  className,
  lineAmount,
  totalLabel,
  totalAmount,
  billing,
  payNowDraft,
  payNowDraftTouched = false,
  onPayNowDraftChange,
}: SaleInvoicePaperProps) {
  const issuedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const boxTitle = invoiceBoxTitle(box[0] || "Paquete");
  const deliveryEta = box[4]?.trim();
  const destinationCountry = recipient?.country?.trim();
  const amountLabel = lineAmount || box[1];
  const isPendingAmount = amountLabel?.toLowerCase() === "pendiente" && !billing;
  const hasBalanceDue = billing ? parseMoneyValue(billing.balanceDue) > 0 : false;
  const depositEditable = Boolean(billing && onPayNowDraftChange);
  const showPaymentSplit = billing && (hasBalanceDue || depositEditable);
  const payNowInputValue = payNowDraftTouched
    ? payNowDraft ?? ""
    : payNowDraft || billing?.payNow.replace(/^\$/, "") || "";
  const invoiceAmountCellClass =
    "flex min-w-[5.5rem] shrink-0 items-center justify-end font-serif text-xl font-black tabular-nums leading-none text-slate-900";
  const chargeLines = billing
    ? [
        ...(billing.cartLines.length
          ? billing.cartLines.map((line) => ({
              key: line.catalogKey || line.label,
              label: `${line.label}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
              amount: formatMoneyValue(parseMoneyValue(line.unitPrice) * line.quantity),
            }))
          : [
              {
                key: "box",
                label: `Caja ${boxTitle}${billing.boxCount > 1 ? ` × ${billing.boxCount}` : ""}`,
                amount: billing.boxSubtotalBeforeDiscount,
              },
            ]),
        ...(parseMoneyValue(billing.promotionDiscount) > 0
          ? [
              {
                key: "promotion",
                label: billing.promotion?.name || "Promoción",
                amount: `-${billing.promotionDiscount}`,
              },
            ]
          : []),
        ...(parseMoneyValue(billing.emptyBoxDelivery) > 0
          ? [{ key: "delivery", label: "Entrega a domicilio", amount: billing.emptyBoxDelivery }]
          : []),
        ...(parseMoneyValue(billing.fullBoxPickup) > 0
          ? [{ key: "pickup", label: "Recolección a domicilio", amount: billing.fullBoxPickup }]
          : []),
      ]
    : [];
  const shipmentLabel = billing
    ? billing.cartLines.length === 1
      ? `${billing.cartLines[0]?.label || boxTitle}${
          billing.boxCount > 1 ? ` × ${billing.boxCount}` : ""
        }`
      : `${billing.boxCount} productos`
    : `Caja ${boxTitle}`;

  return (
    <article
      className={`sale-invoice-paper mx-auto flex w-full max-w-[210mm] min-h-[297mm] flex-col overflow-hidden rounded-sm border border-slate-300/90 bg-[#fdfcf8] text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.12),0_24px_48px_rgba(0,0,0,0.08)] ${className ?? ""}`}
    >
      <div className="flex flex-1 flex-col px-8 py-7 sm:px-10 sm:py-9">
        <header className="flex items-start justify-between gap-6 border-b border-slate-300 pb-5">
          <div className="min-w-0">
            <p className="font-serif text-[1.35rem] font-black leading-none tracking-tight text-slate-900">
              Boxario
            </p>
            <p className="mt-1.5 max-w-[12rem] text-[10px] font-medium leading-snug text-slate-600">
              Paquetería y envíos internacionales
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">Factura</p>
            <p className="mt-0.5 font-serif text-lg font-black tabular-nums leading-tight text-slate-900">
              {invoiceNumber}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">{issuedAt}</p>
          </div>
        </header>

        <section className={`mt-5 grid gap-3 ${recipient ? "grid-cols-2" : "grid-cols-1"}`}>
          <InvoicePartyCard
            label="Remitente"
            name={personFullName(sender)}
            phone={senderPhonesLabel(sender)}
            addressLines={salePersonAddressLines(sender)}
          />
          {recipient ? (
            <InvoicePartyCard
              label="Destinatario"
              name={personFullName(recipient)}
              phone={recipient.phone.trim() || undefined}
              addressLines={salePersonAddressLines(recipient)}
              country={recipient.country.trim() || undefined}
            />
          ) : null}
        </section>

        <section className="mt-6 flex-1">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {(deliveryEta || (destinationCountry && !recipient)) ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {deliveryEta ? (
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    Entrega estimada · {deliveryEta}
                  </span>
                ) : null}
                {destinationCountry && !recipient ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    <CountryFlag name={destinationCountry} size="sm" className="h-3.5 w-3.5" />
                    {destinationCountry}
                  </span>
                ) : null}
              </div>
            ) : null}

            {billing ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  {chargeLines.map((line) => (
                    <div key={line.key} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="font-semibold text-slate-900">{line.label}</span>
                      <span className={invoiceAmountCellClass}>{line.amount}</span>
                    </div>
                  ))}
                </div>
                {showPaymentSplit ? (
                  <div className="grid gap-2 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black text-slate-900">Depósito</p>
                      {depositEditable ? (
                        <>
                          <label className={`${invoiceAmountCellClass} gap-0.5 print:hidden`}>
                            <span className="text-slate-400">$</span>
                            <input
                              className="w-12 bg-transparent text-center outline-none"
                              value={payNowInputValue}
                              onChange={(event) =>
                                onPayNowDraftChange?.(event.target.value.replace(/[^\d]/g, ""))
                              }
                              inputMode="numeric"
                              aria-label="Depósito"
                            />
                          </label>
                          <span className={`${invoiceAmountCellClass} hidden print:flex`}>
                            {billing?.payNow}
                          </span>
                        </>
                      ) : (
                        <span className={invoiceAmountCellClass}>{billing?.payNow}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black text-slate-900">Pendiente</p>
                      <span className={invoiceAmountCellClass}>{billing?.balanceDue}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-black text-slate-900">Total pagado</p>
                    <span className="font-serif text-xl font-black tabular-nums text-slate-900">
                      {billing.quotedTotal}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Tu envío</p>
                  <p className="mt-1 font-serif text-xl font-black leading-tight text-slate-900">
                    {shipmentLabel}
                  </p>
                  {isPendingAmount ? (
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">
                      Se define al completar el envío
                    </p>
                  ) : null}
                </div>
                {isPendingAmount ? (
                  <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Abierto
                  </span>
                ) : (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {totalLabel || "Total"}
                    </p>
                    <span className="font-serif text-[1.65rem] font-black leading-none tabular-nums text-slate-900">
                      {totalAmount || box[1]}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}

export type AddressSuggestResponse = {
  ok?: boolean;
  error?: string;
  suggestions?: AddressSuggestion[];
};

export function applyAddressSuggestResult(
  data: AddressSuggestResponse,
  responseOk: boolean,
  setSuggestions: (suggestions: AddressSuggestion[]) => void,
  setValidation: (validation: AddressValidation) => void,
) {
  if (!responseOk || data.ok === false) {
    setSuggestions([]);
    if (data.error?.includes("GOOGLE_MAPS_API_KEY")) {
      setValidation({
        status: "invalid",
        message: "Configura GOOGLE_MAPS_API_KEY en .env.local y reinicia el servidor",
      });
    } else if (data.error) {
      setValidation({ status: "invalid", message: data.error });
    }
    return;
  }

  setSuggestions(data.suggestions || []);
}

export const inputClass =
  "h-11 min-w-0 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] outline-none placeholder:font-semibold placeholder:text-slate-500 focus:border-black";
export const clientFormControlShellClass =
  "rounded-md border-2 border-emerald-400/70 bg-surface-inset shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_8px_18px_rgba(0,0,0,0.22)]";

export const clientFormInputClass =
  `client-form-field h-11 w-full px-3.5 text-[15px] font-black text-[#f8fafc] outline-none transition placeholder:font-bold placeholder:text-slate-500 focus:border-sky-300 focus:ring-4 focus:ring-sky-300/30 ${clientFormControlShellClass}`;

export const clientFormPickerShellClass =
  `box-border inline-flex h-11 w-full min-w-0 items-center gap-2 px-3 text-sm font-black text-[#f8fafc] ${clientFormControlShellClass}`;
export const clientFormLabelClass =
  "text-[11px] font-black uppercase tracking-[0.08em] text-emerald-200";
export const noBrowserAutocomplete = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;

export function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function senderPrimaryPhone(sender: Pick<Sender, "phones">) {
  return sender.phones[0]?.trim() || "";
}

export function senderPhoneKey(sender: Pick<Sender, "phones">) {
  return cleanPhone(senderPrimaryPhone(sender));
}

export function senderPhonesLabel(sender: Pick<Sender, "phones">) {
  return sender.phones.filter(Boolean).join(" · ");
}

export function senderHasPhone(sender: Pick<Sender, "phones">, phone: string) {
  const target = cleanPhone(phone);
  if (!target) {
    return false;
  }

  return sender.phones.some((entry) => cleanPhone(entry) === target);
}

export function normalizePhoneList(phones: string[]) {
  return phones.map((phone) => phone.trim()).filter(Boolean);
}

export {
  formatScheduleDateInput,
  formatScheduleDateInput as formatDateInput,
  minScheduleDateInput,
  minScheduleDatetimeInput,
  resolveScheduleDate,
  resolveScheduleDatetime,
} from "@/lib/schedule-date";

export function CountryBadge({ country }: { country: string }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-black bg-surface-card-header px-2.5 text-[13px] font-black text-[#f8fafc] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
      <Flag country={country} />
      <span className="leading-none">{country}</span>
    </span>
  );
}

export function Flag({ country }: { country: string }) {
  return <CountryFlag name={country} size="sm" />;
}

export function AddressTags({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div
          key={`${label}-${value}`}
          className="rounded-lg border border-black bg-surface-panel px-3 py-2 border-black bg-surface-card"
        >
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="truncate text-sm font-black text-[#f8fafc]">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

export const contextActiveClass = selectedBorderClass;
export const selectedCardClass = selectedBorderClass;
export const senderCardClass = "w-full";
export const recipientCardClass = senderCardClass;
export const boxCardClass =
  "w-full border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-surface-card-hover";

export const saleSteps: { id: SaleStep; label: string; compactLabel: string }[] = [
  { id: "client", label: "Remitente", compactLabel: "Remite" },
  { id: "recipient", label: "Destinatario", compactLabel: "Destino" },
  { id: "box", label: "Caja", compactLabel: "Caja" },
  { id: "delivery", label: "Logistica", compactLabel: "Logíst." },
  { id: "finish", label: "Final", compactLabel: "Final" },
];

export function saleStepCompactLabel(stepId: SaleStep) {
  return saleSteps.find((step) => step.id === stepId)?.compactLabel ?? stepId;
}

export type SaleStepBarItem = {
  id: SaleStep;
  label: string;
  value: string;
  subtitle?: string;
  detail?: string;
  country?: string;
  isActive: boolean;
  isDone: boolean;
  isUnlocked: boolean;
  index: number;
};

function saleStepBarButtonClass(item: SaleStepBarItem) {
  if (item.isActive) {
    return "border-2 border-emerald-600 bg-emerald-600/35 text-emerald-50 shadow-[0_10px_24px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/45";
  }

  if (item.isDone) {
    return "border-emerald-800/80 bg-[#1c2822] text-[#f8fafc] hover:border-emerald-700 hover:bg-[#223028]";
  }

  if (item.isUnlocked) {
    return "border-black bg-surface-card text-slate-300 hover:border-black hover:bg-surface-card-hover";
  }

  return "cursor-not-allowed border-black/80 bg-surface-inset text-slate-600";
}

function saleStepBarBadgeClass(item: SaleStepBarItem) {
  if (item.isActive || item.isDone) {
    return "border-emerald-300 bg-emerald-400 text-slate-950";
  }

  if (item.isUnlocked) {
    return "border-sky-700/80 bg-sky-300 text-slate-950";
  }

  return "border-black bg-surface-card text-slate-500";
}

function saleStepTileInner(step: SaleStepBarItem, options?: { hideDetail?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 lg:gap-1 ${
        options?.hideDetail
          ? "min-h-[4.25rem] sm:min-h-[4.5rem] lg:min-h-[4.75rem]"
          : "min-h-[5.1rem] sm:min-h-[5.35rem] lg:min-h-[5.6rem]"
      }`}
    >
      <div className="flex min-h-[1.75rem] min-w-0 items-center justify-center gap-1 sm:min-h-[2rem] sm:gap-1.5 lg:min-h-[2.125rem]">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black sm:h-7 sm:w-7 sm:text-[11px] lg:h-8 lg:w-8 lg:text-xs ${saleStepBarBadgeClass(
            step,
          )}`}
        >
          {step.isDone ? (
            <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
          ) : (
            step.index + 1
          )}
        </span>
        <span
          className={`min-w-0 truncate text-[10px] font-black uppercase leading-snug tracking-wide sm:text-[11px] lg:text-xs ${
            step.isActive ? "text-emerald-200" : ""
          }`}
        >
          {step.label}
        </span>
      </div>
      <span
        className={`flex min-h-[1.125rem] min-w-0 items-center justify-center sm:min-h-[1.25rem] ${
          step.isActive ? "text-emerald-100" : "text-slate-400"
        }`}
      >
        <span
          className={`min-w-0 truncate leading-snug ${
            step.id === "box"
              ? "text-[11px] font-black sm:text-xs"
              : "text-[10px] font-bold sm:text-[11px] lg:text-xs"
          }`}
        >
          {step.value}
        </span>
      </span>
      <span
        className={`flex min-h-[1.125rem] min-w-0 items-center justify-center gap-1.5 sm:min-h-[1.25rem] ${
          step.country || step.subtitle
            ? step.isActive
              ? "text-emerald-100"
              : "text-slate-400"
            : "invisible"
        }`}
        aria-hidden={!step.country && !step.subtitle}
      >
        {step.country ? <Flag country={step.country} /> : null}
        <span className="min-w-0 truncate text-[10px] font-bold leading-snug sm:text-[11px] lg:text-xs">
          {step.country || step.subtitle || "\u00a0"}
        </span>
      </span>
      {options?.hideDetail ? null : (
        <span
          className={`flex min-h-[1.125rem] w-full items-center justify-center truncate text-center sm:min-h-[1.25rem] ${
            step.detail && (step.isActive || step.isDone)
              ? step.id === "box"
                ? step.isActive
                  ? "text-sm font-black text-emerald-300 sm:text-base"
                  : "text-sm font-black text-emerald-400/80"
                : step.isActive
                  ? "text-[10px] font-semibold text-emerald-200/70"
                  : "text-[10px] font-semibold text-slate-500"
              : "invisible"
          }`}
          aria-hidden={!step.detail || !(step.isActive || step.isDone)}
        >
          {step.detail || "\u00a0"}
        </span>
      )}
    </div>
  );
}

function saleStepArrow() {
  return (
    <div className="flex h-3 items-start justify-center" aria-hidden>
      <span className="flex flex-col items-center">
        <span className="h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
        <span className="mt-0.5 h-0.5 w-10 rounded-full bg-emerald-400/90" />
      </span>
    </div>
  );
}

export type SaleStepPopoverSlot = {
  open: boolean;
  trigger: React.ReactNode;
  content: React.ReactNode;
};

export function SaleStepBar({
  steps,
  onOpenStep,
  trailingSlot,
  stepPopovers,
}: {
  steps: SaleStepBarItem[];
  onOpenStep: (step: SaleStep) => void;
  trailingSlot?: React.ReactNode;
  stepPopovers?: Partial<Record<SaleStep, SaleStepPopoverSlot>>;
}) {
  const hasOpenStepPopover = steps.some(
    (step) => step.isActive && stepPopovers?.[step.id]?.open,
  );

  return (
    <nav aria-label="Pasos de venta" className="w-full">
      <div
        className={`${flowStepBarShellClass} ${flowStepBarPaddingClass} ${
          hasOpenStepPopover ? "overflow-visible pb-[min(40vh,17rem)]" : "pb-1"
        }`}
      >
        <div className="flex items-start gap-2">
          <ol className="flex min-w-0 flex-1 items-start gap-0">
          {steps.map((step, index) => {
            const connectorDone =
              index > 0 && (steps[index - 1]?.isDone || steps[index - 1]?.isActive);

            return (
              <Fragment key={step.id}>
                {index > 0 ? (
                  <div
                    aria-hidden
                    className="mt-7 flex w-1 shrink-0 items-center sm:mt-8 sm:w-1.5 lg:mt-[2.125rem] lg:w-2"
                  >
                    <span
                      className={`block h-0.5 w-full rounded-full ${
                        connectorDone ? "bg-emerald-500/75" : "bg-black/80"
                      }`}
                    />
                  </div>
                ) : null}
                <li className="relative flex min-w-0 flex-1 flex-col">
                  {step.isActive && stepPopovers?.[step.id] ? (
                    <div
                      className={`min-w-0 w-full overflow-hidden rounded-md border text-center transition sm:rounded-lg ${saleStepBarButtonClass(
                        step,
                      )}`}
                    >
                      <button
                        type="button"
                        disabled={!step.isUnlocked}
                        onClick={() => onOpenStep(step.id)}
                        title={`${step.label}: ${step.value}`}
                        aria-current="step"
                        className="w-full px-1.5 py-1.5 text-center sm:px-2 sm:py-2"
                      >
                        {saleStepTileInner(step, { hideDetail: true })}
                      </button>
                      <div className="border-t border-black/45 bg-black/15 px-1.5 pb-1.5 pt-1 sm:px-2 sm:pb-2 sm:pt-1.5">
                        {stepPopovers[step.id]?.trigger}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!step.isUnlocked}
                      onClick={() => onOpenStep(step.id)}
                      title={`${step.label}: ${step.value}`}
                      aria-current={step.isActive ? "step" : undefined}
                      className={`min-w-0 w-full rounded-md border px-1.5 py-1.5 text-center transition sm:px-2 sm:py-2 lg:rounded-lg lg:px-2.5 lg:py-2 ${saleStepBarButtonClass(
                        step,
                      )}`}
                    >
                      {saleStepTileInner(step)}
                    </button>
                  )}

                  {step.isActive && stepPopovers?.[step.id]?.open ? (
                    <>
                      {saleStepArrow()}
                      <div className="absolute left-1/2 top-full z-30 mt-1 w-[min(calc(100vw-1.25rem),22rem)] -translate-x-1/2 sm:w-[min(calc(100vw-2rem),24rem)]">
                        {stepPopovers[step.id]?.content}
                      </div>
                    </>
                  ) : (
                    <div
                      className="flex h-3 items-start justify-center"
                      aria-hidden={!step.isActive}
                    >
                      {step.isActive ? saleStepArrow() : null}
                    </div>
                  )}
                </li>
              </Fragment>
            );
          })}
          </ol>
          {trailingSlot ? (
            <div className="mt-1.5 shrink-0 self-start sm:mt-2 lg:mt-[0.625rem]">
              {trailingSlot}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

export function saleStepNumber(step: SaleStep) {
  const index = saleSteps.findIndex((item) => item.id === step);
  return index >= 0 ? index + 1 : undefined;
}

export type SaleFlowNavProps = {
  activeStep: SaleStep;
  activeStepIndex: number;
  completedStepIndex: number;
  maxUnlockedStepIndex: number;
  canOpenStep: (step: SaleStep) => boolean;
  openStep: (step: SaleStep) => void;
  goStep: (direction: -1 | 1) => void;
  onOpenHistory?: () => void;
  variant?: "float" | "panel";
};

export type SaleHistoryNavProps = {
  onBack: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

export function SaleHistoryNav({ onBack, onRefresh, refreshing = false }: SaleHistoryNavProps) {
  return (
    <div className="rounded-xl border border-black bg-surface-panel p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] ring-1 ring-black">
      <div className="mb-3 border-b border-black pb-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Historial</p>
        <p className="text-[11px] font-black text-slate-500">Ventas y movimientos</p>
      </div>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-black bg-surface-card text-sm font-black text-[#f8fafc] transition hover:bg-surface-card-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a venta
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-black bg-emerald-400 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          Actualizar
        </button>
      </div>
    </div>
  );
}

export function SaleFlowNav({
  activeStep,
  activeStepIndex,
  completedStepIndex,
  maxUnlockedStepIndex,
  canOpenStep,
  openStep,
  goStep,
  onOpenHistory,
  variant = "float",
}: SaleFlowNavProps) {
  const currentStep = saleSteps[activeStepIndex] ?? saleSteps[0];

  const flowPanel = (
    <div className="rounded-xl border border-black bg-surface-panel p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] ring-1 ring-black">
          <div className="mb-3 border-b border-black pb-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              Flujo de venta
            </p>
            <p className="text-[11px] font-black text-slate-500">
              Paso {activeStepIndex + 1} de {saleSteps.length}
            </p>
          </div>
          <div className="grid gap-2">
            {saleSteps.map((step, index) => {
              const isActive = activeStep === step.id;
              const isUnlocked = canOpenStep(step.id);
              const isDone = index < completedStepIndex;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => openStep(step.id)}
                  className={`relative flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${saleStepButtonClass(
                    isActive,
                    isUnlocked,
                  )}`}
                  title={step.label}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-black ${
                      isActive
                        ? "bg-slate-950 text-emerald-300"
                        : isDone
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-surface-inset text-slate-400"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{step.label}</span>
                    <span
                      className={`block text-[10px] font-black uppercase ${
                        isActive ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {isActive ? "Actual" : isDone ? "Listo" : isUnlocked ? "Abierto" : "Bloqueado"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => goStep(-1)}
              disabled={activeStepIndex <= 0}
              className="flex h-10 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goStep(1)}
              disabled={activeStepIndex >= maxUnlockedStepIndex}
              className="flex h-10 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          {onOpenHistory ? (
            <button
              type="button"
              onClick={onOpenHistory}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-black bg-surface-inset text-sm font-black text-slate-300 transition hover:bg-surface-card hover:text-[#f8fafc]"
            >
              <History className="h-4 w-4" aria-hidden />
              Historial
            </button>
          ) : null}
    </div>
  );

  if (variant === "panel") {
    return flowPanel;
  }

  return (
    <>
      <aside className="sticky top-3 z-40 hidden md:block">
        {flowPanel}
      </aside>

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <div className="rounded-xl border border-black bg-surface-panel p-2 shadow-2xl shadow-black ring-1 ring-black">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => goStep(-1)}
              disabled={activeStepIndex <= 0}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => openStep(currentStep.id)}
              className="min-w-0 rounded-lg border border-emerald-600 bg-emerald-400 px-3 py-2 text-left text-slate-950"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-base font-black text-[#f8fafc]">{currentStep.label}</span>
                <span className="shrink-0 rounded-md bg-emerald-400 px-2 py-1 text-xs font-black text-slate-950">
                  {activeStepIndex + 1}/5
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {saleSteps.map((step, index) => {
                  const isActive = activeStep === step.id;
                  const isDone = index < completedStepIndex;
                  const isUnlocked = canOpenStep(step.id);

                  return (
                    <span
                      key={step.id}
                      className={`h-1.5 flex-1 rounded-full ${
                        isActive || isDone
                          ? "bg-emerald-300"
                          : isUnlocked
                            ? "bg-surface-card"
                            : "bg-[#1f2937]"
                      }`}
                    />
                  );
                })}
              </div>
            </button>

            <button
              type="button"
              onClick={() => goStep(1)}
              disabled={activeStepIndex >= maxUnlockedStepIndex}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
