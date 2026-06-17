import { ArrowLeft, Check, ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import {
  flowStepBarPaddingClass,
  flowStepBarShellClass,
} from "@/components/flow-form-styles";
import { cardHoverClass, selectionActiveClass, selectionShellClass, unselectedDimClass } from "@/components/ui-blocks";
import { resolveCountryCode } from "@/lib/country-options";
import type { SaleRecipient, SaleSender } from "@/lib/customers/mappers";

export function saleStepButtonClass(isActive: boolean, isUnlocked: boolean) {
  if (isActive) {
    return "border-emerald-600 bg-emerald-400 text-slate-950";
  }

  if (isUnlocked) {
    return "border-black bg-surface-card text-slate-300 hover:border-black hover:bg-surface-card-hover";
  }

  return "cursor-not-allowed border-black bg-surface-inset text-slate-500";
}

export { unselectedDimClass } from "@/components/ui-blocks";
export const selectedBorderClass = `${selectionShellClass} ${selectionActiveClass}`;

export function deliveryModeCardClass(selected: boolean, groupHasSelection: boolean) {
  if (selected) {
    return `relative overflow-hidden ${selectedBorderClass}`;
  }

  const base = `${cardHoverClass} border border-black bg-surface-panel`;
  return groupHasSelection ? `${base} ${unselectedDimClass}` : base;
}

export function deliveryModeIconClass(selected: boolean) {
  return selected
    ? "border-emerald-500/50 bg-emerald-400/15 text-emerald-300"
    : "border-black bg-surface-inset text-slate-400";
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

export type SaleStep = "client" | "recipient" | "box" | "delivery" | "finish";
export type AddressFormKind = "client" | "recipient";
export type AddressValidation = {
  status: "idle" | "checking" | "valid" | "invalid";
  message: string;
  formattedAddress?: string;
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

export const countryCodes: Record<string, string> = {
  USA: "US",
  Mexico: "MX",
  Guatemala: "GT",
  Colombia: "CO",
  Honduras: "HN",
};

export function parseMoney(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

export function boxProfitDisplay(box: string[]) {
  const profit = parseMoney(box[1] || "0") - parseMoney(box[2] || "0");
  return `$${Math.max(profit, 0)}`;
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
  invoiceNumber: string;
  sender: Sender;
  recipient: Recipient;
  box: string[];
  deliveryLine: string;
  className?: string;
};

export function SaleInvoicePaper({
  invoiceNumber,
  sender,
  recipient,
  box,
  deliveryLine,
  className,
}: SaleInvoicePaperProps) {
  const issuedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <article
      className={`w-full shrink-0 overflow-hidden rounded-sm border border-slate-300 bg-[#fdfcf8] text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.06),0_6px_18px_rgba(0,0,0,0.1)] ${className ?? ""}`}
    >
      <div className="border-b border-dashed border-slate-300 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-lg font-black tracking-tight text-slate-900">Boxario</p>
            <p className="text-[11px] font-medium text-slate-600">Paqueteria y envios internacionales</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Factura</p>
            <p className="font-serif text-xl font-black tabular-nums text-slate-900">{invoiceNumber}</p>
            <p className="text-[11px] text-slate-600">{issuedAt}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Remitente</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{personFullName(sender)}</p>
          <p className="text-xs text-slate-700">{senderPhonesLabel(sender)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Destinatario</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{personFullName(recipient)}</p>
          <p className="text-xs text-slate-600">
            {[recipient.city, recipient.country].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-600">
              <th className="pb-1.5 font-bold">Concepto</th>
              <th className="pb-1.5 text-right font-bold">Importe</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            <tr className="border-b border-slate-200">
              <td className="py-2 pr-2 align-top">
                <p className="font-bold">Caja {box[0]}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {box[3]} · {box[4]} · {recipient.country}
                </p>
              </td>
              <td className="py-2 text-right align-top font-bold tabular-nums">{box[1]}</td>
            </tr>
            <tr>
              <td className="py-2 pr-2 align-top">
                <p className="font-bold">Entrega caja vacia</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{deliveryLine}</p>
              </td>
              <td className="py-2 text-right align-top tabular-nums text-slate-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-300 bg-slate-100/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-700">
          <span>Costo carrier</span>
          <span className="font-semibold tabular-nums">{box[2]}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-300 pt-2">
          <span className="text-sm font-black uppercase tracking-wide text-slate-900">Total a cobrar</span>
          <span className="font-serif text-2xl font-black tabular-nums text-slate-900">{box[1]}</span>
        </div>
        <p className="mt-1 text-right text-[11px] text-slate-500">Ganancia: {boxProfitDisplay(box)}</p>
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
export const clientFormInputClass =
  "client-form-field h-11 w-full rounded-md border-2 border-emerald-400/70 bg-[#f8fafc] px-3.5 text-[15px] font-black text-slate-950 shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_8px_18px_rgba(0,0,0,0.22)] outline-none transition placeholder:font-bold placeholder:text-slate-500 focus:border-sky-300 focus:ring-4 focus:ring-sky-300/30";
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

export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function CountryBadge({ country }: { country: string }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-black bg-surface-card-header px-2.5 text-[13px] font-black text-[#f8fafc] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
      <Flag country={country} />
      <span className="leading-none">{country}</span>
    </span>
  );
}

export function Flag({ country }: { country: string }) {
  const code = resolveCountryCode({ code: "", name: country }) || countryCodes[country] || "";
  const base =
    "inline-block h-[18px] w-[30px] shrink-0 overflow-hidden rounded-[5px] border border-black bg-slate-700 shadow-[0_1px_0_rgba(255,255,255,0.12),0_6px_12px_rgba(0,0,0,0.22)]";

  if (!code) {
    return (
      <span className={`${base} flex items-center justify-center text-[9px] font-black text-slate-300`}>
        --
      </span>
    );
  }

  return (
    <span
      className={`${base} bg-cover bg-center`}
      style={{ backgroundImage: `url(https://flagcdn.com/w80/${code.toLowerCase()}.png)` }}
      role="img"
      aria-label={country}
    />
  );
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
export const senderCardClass =
  "w-full border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-surface-card-hover";
export const recipientCardClass =
  "w-full border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-surface-card-hover";
export const boxCardClass =
  "w-full border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-surface-card-hover";

export const saleSteps: { id: SaleStep; label: string }[] = [
  { id: "client", label: "Remitente" },
  { id: "recipient", label: "Destinatario" },
  { id: "box", label: "Caja" },
  { id: "delivery", label: "Entrega" },
  { id: "finish", label: "Final" },
];

export type SaleStepBarItem = {
  id: SaleStep;
  label: string;
  value: string;
  detail?: string;
  country?: string;
  isActive: boolean;
  isDone: boolean;
  isUnlocked: boolean;
  index: number;
};

function saleStepBarButtonClass(item: SaleStepBarItem) {
  if (item.isActive) {
    return "border-emerald-500/60 bg-emerald-500/10 text-[#f8fafc] shadow-[inset_0_1px_0_rgba(52,211,153,0.12)] ring-1 ring-emerald-500/25";
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

export function SaleStepBar({
  steps,
  onOpenStep,
}: {
  steps: SaleStepBarItem[];
  onOpenStep: (step: SaleStep) => void;
}) {
  return (
    <nav aria-label="Pasos de venta" className="w-full">
      <div className={`${flowStepBarShellClass} ${flowStepBarPaddingClass}`}>
        <ol className="flex w-full items-stretch gap-0">
          {steps.map((step, index) => {
            const connectorDone =
              index > 0 && (steps[index - 1]?.isDone || steps[index - 1]?.isActive);

            return (
              <li key={step.id} className="contents">
                {index > 0 ? (
                  <div
                    aria-hidden
                    className="flex w-1 shrink-0 items-center self-center sm:w-1.5 lg:w-2"
                  >
                    <span
                      className={`block h-0.5 w-full rounded-full ${
                        connectorDone ? "bg-emerald-500/75" : "bg-black/80"
                      }`}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={!step.isUnlocked}
                  onClick={() => onOpenStep(step.id)}
                  title={`${step.label}: ${step.value}`}
                  className={`min-w-0 flex-1 basis-0 rounded-md border px-1.5 py-1.5 text-left transition sm:px-2 sm:py-2 lg:rounded-lg lg:px-2.5 lg:py-2 ${saleStepBarButtonClass(
                    step,
                  )}`}
                >
                  <div className="flex min-h-[3.35rem] flex-col justify-center gap-0.5 sm:min-h-[3.6rem] lg:min-h-[3.75rem] lg:gap-1">
                    <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
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
                          step.isActive ? "text-emerald-300" : ""
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    <span
                      className={`flex min-w-0 items-center gap-1.5 pl-7 sm:pl-8 lg:pl-9 ${
                        step.isActive ? "text-emerald-100/90" : "text-slate-400"
                      }`}
                    >
                      {step.country ? <Flag country={step.country} /> : null}
                      <span className="min-w-0 truncate text-[10px] font-bold leading-snug sm:text-[11px] lg:text-xs">
                        {step.value}
                      </span>
                    </span>
                    {step.detail && step.isActive ? (
                      <span className="hidden truncate pl-7 text-[10px] font-semibold text-slate-500 lg:pl-9 xl:block">
                        {step.detail}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
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
