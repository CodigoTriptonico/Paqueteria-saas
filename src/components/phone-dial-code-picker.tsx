"use client";

import { useMemo } from "react";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  getPhoneCountryByDialCode,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from "@/lib/phone/countries";

type PhoneDialCodePickerProps = {
  dialCode: string;
  onDialCodeChange: (dialCode: string) => void;
  disabled?: boolean;
};

function PhoneCountryFlag({ isoCode, className = "h-5 w-8" }: { isoCode: string; className?: string }) {
  if (!isoCode) {
    return (
      <span
        className={`flex items-center justify-center rounded-md border border-black bg-surface-inset font-black text-slate-400 ${className}`}
      >
        --
      </span>
    );
  }

  return (
    <span
      className={`block shrink-0 overflow-hidden rounded-md border border-black bg-cover bg-center ${className}`}
      style={{
        backgroundImage: `url(https://flagcdn.com/w80/${isoCode.toLowerCase()}.png)`,
      }}
      role="img"
      aria-hidden
    />
  );
}

function countryOptions(selectedDialCode: string) {
  return PHONE_COUNTRIES.map((country: PhoneCountry) => ({
    value: country.dialCode,
    label: country.label,
    searchText: `+${country.dialCode} ${country.label}`,
    icon: (
      <PhoneCountryFlag
        isoCode={country.isoCode}
        className="h-4 w-5"
      />
    ),
    trailing: (
      <span
        className={`text-sm font-black ${country.dialCode === selectedDialCode ? "text-emerald-300" : "text-emerald-400"}`}
      >
        +{country.dialCode}
      </span>
    ),
  }));
}

export function PhoneDialCodePicker({
  dialCode,
  onDialCodeChange,
  disabled = false,
}: PhoneDialCodePickerProps) {
  const selectedCountry = getPhoneCountryByDialCode(dialCode);
  const options = useMemo(() => countryOptions(dialCode), [dialCode]);

  return (
    <InlineSearchPicker
      compact
      disabled={disabled}
      value={dialCode}
      onChange={onDialCodeChange}
      options={options}
      placeholder="+?"
      searchPlaceholder="Buscar país…"
      emptyLabel="Sin resultados"
      ariaLabel={`Código de país: ${selectedCountry.label}`}
      minWidthClass="min-w-[6.5rem]"
      leadingIcon={
        <PhoneCountryFlag isoCode={selectedCountry.isoCode} className="h-5 w-8" />
      }
      formatSelectedLabel={(option) => (option ? `+${option.value}` : "+?")}
    />
  );
}
