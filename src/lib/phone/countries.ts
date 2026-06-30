import { joinDigitGroups } from "@/lib/phone/format-input";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import { buildPhoneCountries } from "@/lib/phone/build-phone-countries";
import { DIAL_CODE_BY_ISO } from "@/lib/phone/dial-codes-by-iso";
import { resolveCountryCodeFromString } from "@/lib/country-options";
import type { PhoneCountry } from "@/lib/phone/countries.types";

export type { PhoneCountry } from "@/lib/phone/countries.types";

export const DEFAULT_PHONE_DIAL_CODE =
  process.env.DEFAULT_PHONE_COUNTRY_CODE?.replace(/\D/g, "") || "1";

const PREFERRED_ISO_BY_DIAL: Record<string, string> = {
  "1": "US",
  "52": "MX",
  "57": "CO",
  "502": "GT",
  "503": "SV",
  "504": "HN",
  "51": "PE",
};

export const PHONE_COUNTRIES: PhoneCountry[] = buildPhoneCountries();

export function getPhoneIsoForCountryName(countryName: string): string | undefined {
  const iso = resolveCountryCodeFromString(countryName);

  if (!iso || !DIAL_CODE_BY_ISO[iso]) {
    return undefined;
  }

  return iso;
}

export function getPhoneDialCodeForCountryName(countryName: string): string | undefined {
  const iso = getPhoneIsoForCountryName(countryName);

  return iso ? DIAL_CODE_BY_ISO[iso] : undefined;
}

export function getPhoneCountryByDialCode(dialCode: string) {
  const preferredIso = PREFERRED_ISO_BY_DIAL[dialCode];
  if (preferredIso) {
    const preferred = PHONE_COUNTRIES.find((country) => country.isoCode === preferredIso);
    if (preferred) {
      return preferred;
    }
  }

  return (
    PHONE_COUNTRIES.find((country) => country.dialCode === dialCode) ??
    PHONE_COUNTRIES.find((country) => country.isoCode === "US") ??
    PHONE_COUNTRIES[0]
  );
}

export function minNationalDigitsForDialCode(dialCode: string) {
  return getPhoneCountryByDialCode(dialCode).nationalMinDigits;
}

export function maxNationalDigitsForDialCode(dialCode: string) {
  return getPhoneCountryByDialCode(dialCode).nationalMaxDigits;
}

export function nationalInputMaxLength(dialCode: string) {
  const country = getPhoneCountryByDialCode(dialCode);
  const digitCount = country.nationalMaxDigits;
  const separators = Math.max(0, country.nationalGroupSizes.length - 1);
  return digitCount + separators;
}

export function isValidNationalPhone(
  raw: string,
  defaultDialCode: string = DEFAULT_PHONE_DIAL_CODE,
) {
  const { dialCode, nationalDigits } = splitPhoneNumber(raw, defaultDialCode);
  const length = nationalDigits.length;

  if (!length) {
    return false;
  }

  return (
    length >= minNationalDigitsForDialCode(dialCode) &&
    length <= maxNationalDigitsForDialCode(dialCode)
  );
}

export function formatNationalPhoneDigits(dialCode: string, nationalDigits: string) {
  const country = getPhoneCountryByDialCode(dialCode);
  const capped = normalizePhoneDigits(nationalDigits).slice(0, maxNationalDigitsForDialCode(dialCode));
  return joinDigitGroups(capped, country.nationalGroupSizes);
}

export function coerceNationalPhoneInput(dialCode: string, raw: string) {
  return formatNationalPhoneDigits(dialCode, raw);
}

export function normalizePhoneCountrySearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function filterPhoneCountries(query: string): PhoneCountry[] {
  const normalizedQuery = normalizePhoneCountrySearch(query.trim());

  if (!normalizedQuery) {
    return PHONE_COUNTRIES;
  }

  return PHONE_COUNTRIES.filter((country) => {
    const haystack = normalizePhoneCountrySearch(
      `${country.label} ${country.dialCode} +${country.dialCode} ${country.isoCode}`,
    );
    return haystack.includes(normalizedQuery);
  });
}

export function splitPhoneNumber(
  raw: string,
  defaultDialCode: string = DEFAULT_PHONE_DIAL_CODE,
): { dialCode: string; nationalDigits: string } {
  const digits = normalizePhoneDigits(raw);

  if (!digits) {
    return { dialCode: defaultDialCode, nationalDigits: "" };
  }

  const byDialLength = [...PHONE_COUNTRIES].sort(
    (left, right) => right.dialCode.length - left.dialCode.length,
  );

  // Solo código de país (p. ej. tras cambiar el selector): no tomar prefijos más cortos (+52 dentro de 503).
  for (const country of byDialLength) {
    if (digits === country.dialCode) {
      return { dialCode: country.dialCode, nationalDigits: "" };
    }
  }

  for (const country of byDialLength) {
    if (!digits.startsWith(country.dialCode)) {
      continue;
    }

    const nationalDigits = digits.slice(country.dialCode.length);

    if (nationalDigits.length > 0) {
      return { dialCode: country.dialCode, nationalDigits };
    }
  }

  if (digits.length === 10 && defaultDialCode === "1") {
    return { dialCode: "1", nationalDigits: digits };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { dialCode: "1", nationalDigits: digits.slice(1) };
  }

  return { dialCode: defaultDialCode, nationalDigits: digits };
}

/** Builds stored display value: +{dial}-{national} */
export function buildPhoneNumber(dialCode: string, nationalDigits: string) {
  const formattedNational = formatNationalPhoneDigits(dialCode, nationalDigits);

  if (!formattedNational) {
    return `+${dialCode}`;
  }

  return `+${dialCode}-${formattedNational}`;
}
