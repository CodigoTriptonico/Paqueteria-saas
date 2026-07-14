"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
} from "lucide-react";
import {
  type AddressSuggestion,
  type AddressValidation,
} from "@/components/sale/venta-parts";
import {
  resolveAddressValidationUi,
  type AddressValidationTone,
} from "@/lib/sale-address-validation-ui";

type SaleAddressGooglePanelProps = {
  enabled?: boolean;
  disabledMessage?: string;
  validation: AddressValidation;
  searching?: boolean;
  suggestions: AddressSuggestion[];
  unverifiedAccepted: boolean;
  hasRequiredAddress: boolean;
  fullAddress: string;
  listboxId: string;
  unverifiedButtonLabel?: string;
  showUnverifiedOption?: boolean;
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  onUseUnverified: () => void;
};

const statusPanelClass: Record<AddressValidationTone, string> = {
  disabled: "border-black bg-surface-inset text-slate-400",
  idle: "border-sky-400/45 bg-[#14262b] text-sky-100",
  searching: "border-sky-300 bg-[#14262b] text-sky-100",
  checking: "border-sky-300 bg-[#14262b] text-sky-100",
  suggestions: "border-sky-400/45 bg-[#14262b] text-sky-100",
  valid: "border-emerald-500/70 bg-[#1a2e28] text-emerald-100",
  invalid: "border-amber-600 bg-amber-400 text-slate-950",
  unverified: "border-amber-600 bg-amber-400 text-slate-950",
};

const previewPanelClass: Record<
  "muted" | "valid" | "invalid" | "unverified" | "disabled",
  string
> = {
  disabled: "border-black bg-surface-inset text-slate-500",
  muted: "border-black bg-surface-inset text-slate-300",
  valid: "border-emerald-500/50 bg-[#1a2e28] text-emerald-50",
  invalid: "border-amber-600 bg-amber-400 text-slate-950",
  unverified: "border-amber-600 bg-amber-400 text-slate-950",
};

function StatusIcon({ tone }: { tone: AddressValidationTone }) {
  if (tone === "valid") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />;
  }

  if (tone === "invalid" || tone === "unverified") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" aria-hidden />;
  }

  if (tone === "disabled") {
    return <MapPin className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />;
  }

  return null;
}

function LoadingZone({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-sky-400/35 bg-[#14262b] px-3.5 py-2.5 text-sky-100">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">{title}</p>
        <p className="mt-0.5 text-sm font-bold leading-snug">{message}</p>
      </div>
    </div>
  );
}

export function SaleAddressGooglePanel({
  enabled = true,
  disabledMessage,
  validation,
  searching = false,
  suggestions,
  unverifiedAccepted,
  hasRequiredAddress,
  fullAddress,
  listboxId,
  unverifiedButtonLabel = "Usar sin verificar",
  showUnverifiedOption = true,
  onSelectSuggestion,
  onUseUnverified,
}: SaleAddressGooglePanelProps) {
  const ui = resolveAddressValidationUi({
    enabled,
    disabledMessage,
    searching,
    validation,
    suggestionsCount: suggestions.length,
    unverifiedAccepted,
    hasRequiredAddress,
    fullAddress,
  });

  const statusPanel = ui.showStatusPanel ? (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 ${statusPanelClass[ui.tone]}`}
      role="status"
      aria-live="polite"
    >
      <StatusIcon tone={ui.tone} />
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">{ui.title}</p>
        <p className="mt-0.5 text-sm font-bold leading-snug">{ui.message}</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-3">
      {ui.tone === "disabled" ? (
        statusPanel
      ) : (
        <>
          {ui.showPreview ? (
            <div className="space-y-1.5">
              {ui.previewLabel ? (
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                  {ui.previewLabel}
                </p>
              ) : null}
              <p
                className={`rounded-lg border px-3.5 py-2.5 text-sm font-bold leading-snug break-words ${previewPanelClass[ui.previewTone]}`}
              >
                {ui.previewText}
              </p>
            </div>
          ) : null}

          {ui.tone === "searching" || ui.tone === "checking" ? (
            <LoadingZone title={ui.title} message={ui.message} />
          ) : null}

          {ui.showSuggestions ? (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Sugerencias de Google"
              className="overflow-hidden rounded-lg border border-sky-400/40 bg-[#101820]"
            >
              <p className="border-b border-black bg-[#17252f] px-4 py-2 text-xs font-black uppercase text-sky-200">
                {ui.suggestionsTitle}
              </p>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="grid w-full gap-0.5 border-b border-black px-4 py-3 text-left transition last:border-b-0 hover:bg-emerald-400/10 focus-visible:bg-emerald-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70"
                >
                  <span className="truncate text-sm font-black text-[#f8fafc]">
                    {suggestion.mainText}
                  </span>
                  <span className="truncate text-xs font-bold text-slate-300">
                    {[suggestion.secondaryText, suggestion.postalCode].filter(Boolean).join(" · CP ")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {ui.tone === "idle" && !ui.showSuggestions ? (
            <p className="text-xs font-bold leading-snug text-slate-400">{ui.message}</p>
          ) : null}

          {ui.showUnverifiedButton && showUnverifiedOption ? (
            <button
              type="button"
              onClick={onUseUnverified}
              disabled={!hasRequiredAddress}
              className="h-10 w-full rounded-md border border-amber-700/60 bg-amber-950/50 px-4 text-sm font-black text-amber-100 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {unverifiedButtonLabel}
            </button>
          ) : null}

          {statusPanel}
        </>
      )}
    </div>
  );
}
