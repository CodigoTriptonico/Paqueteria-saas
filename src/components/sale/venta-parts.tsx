import { Check } from "lucide-react";
import { Fragment } from "react";
import {
  flowStepBarPaddingClass,
  flowStepBarShellClass,
} from "@/components/flow-form-styles";
import { cardHoverClass, insetShellClass, selectionActiveClass, selectionShellClass } from "@/components/ui-blocks";
import { CountryFlag } from "@/components/country-flag";
import { InvoiceQrCode } from "@/components/sale/invoice-qr-code";
import type { InvoiceBillingSnapshot } from "@/lib/invoice-billing";
import type { LogisticsTaskType } from "@/lib/logistics-routing";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import type { OrganizationBranding } from "@/lib/organizations/branding";
import {
  organizationBrandInitials,
  PLATFORM_BRAND_TITLE,
} from "@/lib/organizations/branding";
import type { SaleRecipient, SaleSender } from "@/lib/customers/mappers";
import {
  saleInvoiceEtaLabel,
  saleInvoiceServiceLabel,
} from "@/lib/sale-invoice-service";
import { formatScheduleAtDisplay, scheduleTimeComplete } from "@/lib/sale/schedule-time";

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
const selectedBorderClass = `${selectionShellClass} ${selectionActiveClass}`;

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
    addressReference?: string;
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

function scheduledModeComplete(scheduleMode: string, scheduleAt: string) {
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
  needsUnit?: boolean;
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

export function historyDateLabel(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type SaleInvoicePaperProps = {
  branding?: OrganizationBranding | null;
  invoiceNumber: string;
  parentInvoiceNumber?: string;
  boxPosition?: number;
  boxCount?: number;
  sender: Sender;
  recipient?: Recipient | null;
  box: string[];
  serviceOperation: LogisticsTaskType;
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
  eta,
}: {
  label: string;
  name: string;
  phone?: string;
  addressLines: string[];
  country?: string;
  eta?: string;
}) {
  const etaLabel = saleInvoiceEtaLabel(eta);

  return (
    <div className="relative overflow-hidden rounded-sm border border-zinc-300 bg-white px-4 py-3">
      <p className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-[15px] font-black leading-snug text-zinc-950">{name}</p>
      {phone ? <p className="mt-1 text-[11px] font-bold leading-snug text-zinc-700">{phone}</p> : null}
      {addressLines.map((line) => (
        <p key={line} className="mt-0.5 text-[11px] leading-snug text-zinc-600">
          {line}
        </p>
      ))}
      {country || etaLabel ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-snug">
          {country ? <span className="font-black text-zinc-950">{country}</span> : null}
          {country && etaLabel ? <span className="text-zinc-400">·</span> : null}
          {etaLabel ? <span className="font-bold text-zinc-600">{etaLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function SaleInvoicePaper({
  branding,
  invoiceNumber,
  parentInvoiceNumber,
  boxPosition,
  boxCount,
  sender,
  recipient,
  box,
  serviceOperation,
  className,
  lineAmount,
  totalLabel,
  totalAmount,
  billing,
  payNowDraft,
  payNowDraftTouched = false,
  onPayNowDraftChange,
}: SaleInvoicePaperProps) {
  const companyName = branding?.name?.trim() || PLATFORM_BRAND_TITLE;
  const companyBadgeLabel = organizationBrandInitials(
    branding?.shortName?.trim() || branding?.brandTitle || companyName,
  );
  const issuedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const boxTitle = invoiceBoxTitle(box[0] || "Paquete");
  const isBoxInvoice = Boolean(parentInvoiceNumber);
  const deliveryEta = box[4]?.trim();
  const amountLabel = lineAmount || box[1];
  const isPendingAmount = amountLabel?.toLowerCase() === "pendiente" && !billing;
  const hasBalanceDue = billing ? parseMoneyValue(billing.balanceDue) > 0 : false;
  const depositEditable = Boolean(billing && onPayNowDraftChange);
  const showPaymentSplit = billing && (hasBalanceDue || depositEditable);
  const depositLabel =
    !depositEditable && billing?.depositStatus === "pending"
      ? "Depósito pendiente"
      : "Depósito";
  const payNowInputValue = payNowDraftTouched
    ? payNowDraft ?? ""
    : payNowDraft || billing?.payNow.replace(/^\$/, "") || "";
  const invoiceAmountCellClass =
    "min-w-[6rem] shrink-0 text-right font-serif text-xl font-black tabular-nums leading-none text-zinc-950";
  const invoiceAmountInputClass =
    "inline w-[4.5rem] bg-transparent p-0 text-right font-serif text-xl font-black tabular-nums leading-none text-zinc-950 outline-none";
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
      className={`sale-invoice-paper relative mx-auto flex w-full max-w-[210mm] min-h-[297mm] flex-col overflow-hidden rounded-sm bg-white text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.25),0_18px_40px_rgba(0,0,0,0.18),0_44px_70px_rgba(0,0,0,0.12)] ${className ?? ""}`}
    >
      <div className="flex flex-1 flex-col px-8 py-7 sm:px-10 sm:py-9">
        <div className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b-2 border-zinc-950 pb-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-sm border-2 border-zinc-950 bg-white text-[14px] font-black tracking-[-0.04em] shadow-[3px_3px_0_#d4d4d8]">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              companyBadgeLabel
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">
              Paqueteria y envios internacionales
            </p>
            <div className="mt-1 h-px bg-zinc-300" />
          </div>
          <div className="text-right text-[8px] font-black uppercase tracking-[0.18em] text-zinc-600">
            <span>USA</span>
            <span className="mx-1.5">/</span>
            <span>MX</span>
          </div>
        </div>
        <header className="relative overflow-hidden border-b-2 border-zinc-950 pb-6">
          <div className="absolute right-0 top-0 h-20 w-20 rounded-full border border-zinc-200" />
          <div className="absolute right-8 top-8 h-24 w-24 rounded-full border border-zinc-200" />
          <div className="relative flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="font-serif text-[1.55rem] font-black leading-none tracking-tight text-zinc-950">
              {companyName}
            </p>
            <p className="mt-2 max-w-[15rem] text-[10px] font-bold uppercase leading-snug tracking-[0.08em] text-zinc-600">
              Paquetería y envíos internacionales
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-600">
              {isBoxInvoice ? "Factura de caja" : "Factura"}
            </p>
            <p className="mt-1 font-serif text-[1.65rem] font-black tabular-nums leading-tight text-zinc-950">
              {invoiceNumber}
            </p>
            <p className="mt-1 text-[10px] font-bold text-zinc-600">{issuedAt}</p>
          </div>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">
            <span className="h-px bg-zinc-400" />
            <span>{saleInvoiceServiceLabel(serviceOperation)}</span>
            <span className="h-px bg-zinc-400" />
          </div>
        </header>

        <section className={`mt-5 grid gap-3 ${recipient ? "grid-cols-2" : "grid-cols-1"}`}>
          <InvoicePartyCard
            label="Remitente"
            name={personFullName(sender)}
            phone={senderPhonesLabel(sender)}
            addressLines={salePersonAddressLines(sender)}
            eta={!recipient ? deliveryEta : undefined}
          />
          {recipient ? (
            <InvoicePartyCard
              label="Destinatario"
              name={personFullName(recipient)}
              phone={recipient.phone.trim() || undefined}
              addressLines={salePersonAddressLines(recipient)}
              country={recipient.country.trim() || undefined}
              eta={deliveryEta}
            />
          ) : null}
        </section>

        <section className="mt-6 flex-1">
          <div className="rounded-sm border border-zinc-300 bg-white px-4 py-4">
            {isBoxInvoice ? (
              <div className="grid gap-3">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">
                      Caja identificada
                    </p>
                    <p className="mt-1 font-serif text-xl font-black leading-tight text-zinc-950">
                      Caja {boxTitle}
                    </p>
                  </div>
                  {boxPosition && boxCount ? (
                    <span className="shrink-0 rounded-sm border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-900">
                      Caja {boxPosition} de {boxCount}
                    </span>
                  ) : null}
                </div>
                <p className="border-t border-zinc-300 pt-3 text-[10px] font-bold leading-snug text-zinc-600">
                  Factura principal: {parentInvoiceNumber}. Esta hoja identifica esta caja; el cobro total permanece en la factura principal.
                </p>
              </div>
            ) : billing ? (
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
                {chargeLines.map((line) => (
                  <div key={line.key} className="contents">
                    <span className="text-[12px] font-bold text-zinc-900">{line.label}</span>
                    <span className={invoiceAmountCellClass}>{line.amount}</span>
                  </div>
                ))}
                {showPaymentSplit ? (
                  <>
                    <div className="col-span-2 my-1 border-t border-zinc-300" />
                    <p className="text-[11px] font-black text-zinc-900">{depositLabel}</p>
                    <div className={invoiceAmountCellClass}>
                      {depositEditable ? (
                        <>
                          <label className="print:hidden">
                            $<input
                              className={invoiceAmountInputClass}
                              value={payNowInputValue}
                              onChange={(event) =>
                                onPayNowDraftChange?.(event.target.value.replace(/[^\d]/g, ""))
                              }
                              inputMode="numeric"
                              aria-label="Depósito"
                            />
                          </label>
                          <span className="hidden print:inline">{billing?.depositRequired}</span>
                        </>
                      ) : (
                        billing?.depositRequired
                      )}
                    </div>
                    <p className="text-[11px] font-black text-zinc-900">Pendiente</p>
                    <span className={invoiceAmountCellClass}>{billing?.balanceDue}</span>
                  </>
                ) : (
                  <>
                    <div className="col-span-2 my-1 border-t border-zinc-300" />
                    <p className="text-[11px] font-black text-zinc-900">Total pagado</p>
                    <span className={invoiceAmountCellClass}>{billing.quotedTotal}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Tu envío</p>
                  <p className="mt-1 font-serif text-xl font-black leading-tight text-zinc-950">
                    {shipmentLabel}
                  </p>
                  {isPendingAmount ? (
                    <p className="mt-1 text-[11px] font-bold leading-snug text-zinc-600">
                      Se define al completar el envío
                    </p>
                  ) : null}
                </div>
                {isPendingAmount ? (
                  <span className="shrink-0 rounded-sm border border-zinc-500 bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-900">
                    Abierto
                  </span>
                ) : (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                      {totalLabel || "Total"}
                    </p>
                    <span className="font-serif text-[1.65rem] font-black leading-none tabular-nums text-zinc-950">
                      {totalAmount || box[1]}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        <footer className="mt-6 grid grid-cols-[1fr_auto] items-end gap-5 border-t border-zinc-300 pt-4">
          <p className="max-w-[23rem] text-[9px] font-bold uppercase leading-relaxed tracking-[0.12em] text-zinc-600">
            Conserva esta factura para rastreo, cobros y movimientos logisticos.
          </p>
          <InvoiceQrCode
            invoiceNumber={invoiceNumber}
            size={56}
            className="flex h-16 w-16 items-center justify-center rounded-sm border border-zinc-400 bg-white p-1"
          />
        </footer>
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

  const suggestions = data.suggestions || [];
  setSuggestions(suggestions);

  if (!suggestions.length) {
    setValidation({
      status: "idle",
      message: "Google no encontro coincidencias. Revisa la direccion o usala sin verificar.",
    });
  }
}

export const inputClass =
  "h-11 min-w-0 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] outline-none placeholder:font-semibold placeholder:text-slate-500 focus:border-black";
const clientFormControlShellClass =
  "rounded-md border-2 border-emerald-400/70 bg-surface-inset shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_8px_18px_rgba(0,0,0,0.22)]";

const clientFormInputPendingShellClass =
  "rounded-md border-2 border-rose-500/85 bg-[#2a1a1f] shadow-[0_0_0_1px_rgba(244,63,94,0.24),0_8px_18px_rgba(0,0,0,0.22)]";

export const clientFormInputClass =
  `client-form-field h-11 w-full px-3.5 text-[15px] font-black text-[#f8fafc] outline-none transition placeholder:font-bold placeholder:text-slate-500 focus:border-sky-300 focus:ring-4 focus:ring-sky-300/30 ${clientFormControlShellClass}`;

export function clientFormAddressFieldClass(
  value: string,
  options?: { required?: boolean; enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const isPending = enabled && !value.trim();
  const shell = isPending ? clientFormInputPendingShellClass : clientFormControlShellClass;
  const focus = isPending
    ? "focus:border-rose-400 focus:ring-4 focus:ring-rose-400/25"
    : "focus:border-sky-300 focus:ring-4 focus:ring-sky-300/30";

  return `client-form-field h-11 w-full px-3.5 text-[15px] font-black text-[#f8fafc] outline-none transition placeholder:font-bold placeholder:text-slate-500 ${focus} ${shell}`;
}

export function clientFormAddressLabelClass(
  value: string,
  options?: { required?: boolean; enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;

  if (enabled && !value.trim()) {
    return "text-[11px] font-black uppercase tracking-[0.08em] text-rose-400";
  }

  return clientFormLabelClass;
}

export const clientFormPickerShellClass =
  `${insetShellClass} box-border inline-flex h-11 w-full min-w-0 items-center gap-2 px-3 text-sm font-black text-[#f8fafc] ${clientFormControlShellClass}`;
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

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function senderPrimaryPhone(sender: Pick<Sender, "phones">) {
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
  formatScheduleDateInput as formatDateInput,
  minScheduleDateInput,
  resolveScheduleDate,
} from "@/lib/schedule-date";

export function Flag({ country }: { country: string }) {
  return <CountryFlag name={country} size="sm" />;
}

export const contextActiveClass = selectedBorderClass;
export const selectedCardClass = selectedBorderClass;
export const salePersonRowSelectedClass = "bg-emerald-400/10 hover:bg-emerald-400/15";
export const salePersonRowContextActiveClass = "bg-emerald-400/20 hover:bg-emerald-400/25";
export const boxCardClass =
  "w-full border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-surface-card-hover";

export const saleSteps: { id: SaleStep; label: string; compactLabel: string }[] = [
  { id: "client", label: "Remitente", compactLabel: "Remite" },
  { id: "recipient", label: "Destinatario", compactLabel: "Destino" },
  { id: "box", label: "Caja", compactLabel: "Caja" },
  { id: "delivery", label: "Logística", compactLabel: "Logística" },
  { id: "finish", label: "Final", compactLabel: "Final" },
];

export function saleStepCompactLabel(stepId: SaleStep) {
  return saleSteps.find((step) => step.id === stepId)?.compactLabel ?? stepId;
}

export type SaleStepBarItem = {
  id: SaleStep;
  label: string;
  compactLabel: string;
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
      <div className="flex min-h-[1.75rem] min-w-0 flex-col items-center justify-center gap-0.5 sm:min-h-[2rem] sm:flex-row sm:gap-1.5 lg:min-h-[2.125rem]">
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
          className={`w-full min-w-0 max-w-full truncate text-center text-[10px] font-black uppercase leading-snug tracking-wide sm:text-[11px] lg:text-xs ${
            step.isActive ? "text-emerald-200" : ""
          }`}
        >
          <span className="sm:hidden">{step.compactLabel}</span>
          <span className="hidden sm:inline">{step.label}</span>
        </span>
      </div>
      <span
        className={`flex min-h-[1.125rem] w-full min-w-0 max-w-full items-center justify-center sm:min-h-[1.25rem] ${
          step.isActive ? "text-emerald-100" : "text-slate-400"
        }`}
      >
        <span
          className={`w-full min-w-0 max-w-full truncate text-center leading-snug ${
            step.id === "box"
              ? "text-[11px] font-black sm:text-xs"
              : "text-[11px] font-black sm:text-[11px] lg:text-xs"
          }`}
        >
          {step.value}
        </span>
      </span>
      <span
        className={`flex min-h-[1.125rem] w-full min-w-0 max-w-full items-center justify-center gap-1.5 sm:min-h-[1.25rem] ${
          step.country || step.subtitle
            ? step.isActive
              ? "text-emerald-100"
              : "text-slate-400"
            : "invisible"
        }`}
        aria-hidden={!step.country && !step.subtitle}
      >
        {step.country ? (
          <span className="hidden sm:contents">
            <Flag country={step.country} />
          </span>
        ) : null}
        <span className="min-w-0 max-w-full truncate text-center text-[11px] font-black leading-snug sm:text-[11px] lg:text-xs">
          {step.country || step.subtitle || "\u00a0"}
        </span>
      </span>
      {options?.hideDetail ? null : (
        <span
          className={`flex min-h-[1.75rem] w-full min-w-0 max-w-full items-center justify-center overflow-hidden px-1 text-center leading-tight sm:min-h-[1.25rem] ${
            step.detail && (step.isActive || step.isDone)
              ? step.id === "box"
                ? step.isActive
                  ? "text-sm font-black text-emerald-300 sm:text-base"
                  : "text-sm font-black text-emerald-400/80"
                : step.isActive
                  ? "text-[11px] font-black tracking-tight text-emerald-100"
                  : "text-[11px] font-black tracking-tight text-slate-200"
              : "invisible"
          }`}
          aria-hidden={!step.detail || !(step.isActive || step.isDone)}
        >
          <span className="line-clamp-2 max-w-full break-words">{step.detail || "\u00a0"}</span>
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
          <div
            className={`min-w-0 flex-1 ${
              hasOpenStepPopover
                ? "overflow-visible"
                : "snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            }`}
          >
          <ol className="flex min-w-max items-start gap-0 lg:min-w-0 lg:w-full">
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
                <li className="relative flex w-[8.5rem] shrink-0 snap-start flex-col lg:min-w-0 lg:w-auto lg:flex-1">
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
          </div>
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
