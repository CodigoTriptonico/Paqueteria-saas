"use client";

import { useMemo } from "react";
import { Phone } from "lucide-react";
import { inputClass } from "@/components/ui-blocks";
import { PhoneDialCodePicker } from "@/components/phone-dial-code-picker";
import {
  buildPhoneNumber,
  coerceNationalPhoneInput,
  DEFAULT_PHONE_DIAL_CODE,
  formatNationalPhoneDigits,
  getPhoneCountryByDialCode,
  nationalInputMaxLength,
  splitPhoneNumber,
} from "@/lib/phone/countries";

type PhoneCountryInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  hint?: string;
  hintId?: string;
  className?: string;
};

const nationalInputClass = `${inputClass} w-full pl-10`;

export function PhoneCountryInput({
  value,
  onChange,
  id,
  name,
  disabled = false,
  hint,
  hintId,
  className,
}: PhoneCountryInputProps) {
  const { dialCode, nationalDigits } = useMemo(
    () => splitPhoneNumber(value, DEFAULT_PHONE_DIAL_CODE),
    [value],
  );
  const country = getPhoneCountryByDialCode(dialCode);
  const nationalDisplay = formatNationalPhoneDigits(dialCode, nationalDigits);
  const nationalMaxLength = nationalInputMaxLength(dialCode);

  function updateDialCode(nextDialCode: string) {
    onChange(buildPhoneNumber(nextDialCode, nationalDigits));
  }

  function updateNational(nextRaw: string) {
    onChange(buildPhoneNumber(dialCode, coerceNationalPhoneInput(dialCode, nextRaw)));
  }

  return (
    <div className={className}>
      <div className="flex w-full max-w-full flex-wrap items-start gap-2">
        <PhoneDialCodePicker
          dialCode={dialCode}
          disabled={disabled}
          onDialCodeChange={updateDialCode}
        />

        <div className="relative min-w-[10.75rem] flex-1 sm:min-w-[11.5rem]">
          <Phone
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            id={id}
            name={name}
            className={nationalInputClass}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={disabled}
            value={nationalDisplay}
            placeholder={country.placeholder}
            maxLength={nationalMaxLength}
            aria-describedby={hintId}
            onChange={(event) => updateNational(event.target.value)}
          />
        </div>
      </div>

      {hint ? (
        <p id={hintId} className="mt-1 text-center text-xs font-bold text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
