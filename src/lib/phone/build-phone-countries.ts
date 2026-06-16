import { DIAL_CODE_BY_ISO } from "@/lib/phone/dial-codes-by-iso";
import type { PhoneCountry } from "@/lib/phone/countries.types";

const NATIONAL_FORMAT_BY_ISO: Partial<Record<string, number[]>> = {
  US: [3, 3, 4],
  CA: [3, 3, 4],
  MX: [2, 4, 4],
  CO: [3, 3, 4],
  GT: [4, 4],
  SV: [4, 4],
  HN: [4, 4],
  PE: [3, 3, 3],
};

const NATIONAL_LIMITS_BY_ISO: Partial<Record<string, { min: number; max: number }>> = {
  US: { min: 10, max: 10 },
  CA: { min: 10, max: 10 },
  MX: { min: 10, max: 10 },
  CO: { min: 10, max: 10 },
  GT: { min: 8, max: 8 },
  SV: { min: 8, max: 8 },
  HN: { min: 8, max: 8 },
  PE: { min: 9, max: 9 },
};

function nationalLimitsFor(isoCode: string, dialCode: string) {
  const known = NATIONAL_LIMITS_BY_ISO[isoCode];
  if (known) {
    return known;
  }

  if (dialCode === "1") {
    return { min: 10, max: 10 };
  }

  if (dialCode.length <= 2) {
    return { min: 10, max: 10 };
  }

  if (dialCode.length === 3) {
    return { min: 8, max: 10 };
  }

  return { min: 8, max: 10 };
}

const PLACEHOLDER_BY_ISO: Partial<Record<string, string>> = {
  US: "305-555-0100",
  CA: "416-555-0100",
  MX: "55-1234-5678",
  CO: "300-123-4567",
  GT: "5123-4567",
  SV: "7012-3456",
  HN: "9123-4567",
  PE: "912-345-678",
};

function defaultNationalGroupSizes(dialCode: string) {
  if (dialCode === "1") {
    return [3, 3, 4];
  }

  if (dialCode.length >= 3) {
    return [3, 3, 3];
  }

  return [3, 3, 4];
}

function defaultPlaceholder(dialCode: string) {
  if (dialCode === "1") {
    return "305-555-0100";
  }

  return "000-000-0000";
}

export function buildPhoneCountries(): PhoneCountry[] {
  const displayNames = new Intl.DisplayNames(["es"], { type: "region" });

  return Object.keys(DIAL_CODE_BY_ISO)
    .map((isoCode) => {
      const dialCode = DIAL_CODE_BY_ISO[isoCode];

      if (!dialCode) {
        return null;
      }

      const label = displayNames.of(isoCode) || isoCode;

      const limits = nationalLimitsFor(isoCode, dialCode);

      return {
        id: isoCode.toLowerCase(),
        isoCode,
        dialCode,
        label,
        placeholder: PLACEHOLDER_BY_ISO[isoCode] ?? defaultPlaceholder(dialCode),
        nationalGroupSizes:
          NATIONAL_FORMAT_BY_ISO[isoCode] ?? defaultNationalGroupSizes(dialCode),
        nationalMinDigits: limits.min,
        nationalMaxDigits: limits.max,
      };
    })
    .filter((country): country is PhoneCountry => country !== null)
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
