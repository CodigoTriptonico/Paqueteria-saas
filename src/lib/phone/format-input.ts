import { normalizePhoneDigits, PHONE_MAX_DIGITS } from "@/lib/phone/normalize";

/** Display length cap: 15 digits + separators + optional leading "+". */
export const PHONE_INPUT_DISPLAY_MAX_LENGTH = PHONE_MAX_DIGITS + 7;

export function phoneInputHasPlus(raw: string) {
  return /^\s*\+/.test(raw);
}

export function clampPhoneDigits(raw: string) {
  return normalizePhoneDigits(raw).slice(0, PHONE_MAX_DIGITS);
}

export function joinDigitGroups(digits: string, groupSizes: number[]) {
  if (!digits) {
    return "";
  }

  const parts: string[] = [];
  let index = 0;

  for (const size of groupSizes) {
    if (index >= digits.length) {
      break;
    }

    parts.push(digits.slice(index, index + size));
    index += size;
  }

  if (index < digits.length) {
    parts.push(digits.slice(index));
  }

  return parts.join("-");
}

function nanpGroupSizes(digits: string) {
  if (digits.length === 11 && digits.startsWith("1")) {
    return [1, 3, 3, 4];
  }

  return [3, 3, 4];
}

function internationalGroupSizes(digits: string) {
  if (digits.startsWith("1")) {
    return [1, 3, 3, 4, 4];
  }

  if (digits.startsWith("52") || digits.startsWith("57")) {
    return [2, 3, 3, 4, 3];
  }

  if (digits.length >= 12) {
    return [2, 3, 3, 4, 3];
  }

  if (digits.length >= 11) {
    return [2, 3, 3, 3];
  }

  return [2, 3, 4];
}

/**
 * Formats digits with hyphens for tel inputs. Pass digits only (no "+").
 */
export function formatPhoneForInput(digits: string, withPlus: boolean) {
  const normalized = digits.slice(0, PHONE_MAX_DIGITS);

  if (!normalized) {
    return withPlus ? "+" : "";
  }

  if (withPlus) {
    if (normalized.length <= 11 && normalized.startsWith("1")) {
      return `+${joinDigitGroups(normalized, nanpGroupSizes(normalized))}`;
    }

    if (normalized.length <= 10) {
      return `+${joinDigitGroups(normalized, [3, 3, 4])}`;
    }

    return `+${joinDigitGroups(normalized, internationalGroupSizes(normalized))}`;
  }

  if (normalized.length <= 10) {
    return joinDigitGroups(normalized, [3, 3, 4]);
  }

  if (normalized.length === 11 && normalized.startsWith("1")) {
    return joinDigitGroups(normalized, [1, 3, 3, 4]);
  }

  return joinDigitGroups(normalized, internationalGroupSizes(normalized));
}

/**
 * Normalizes user typing/paste into a hyphenated display value and enforces digit cap.
 */
export function coercePhoneInput(raw: string) {
  const withPlus = phoneInputHasPlus(raw);
  const digits = clampPhoneDigits(raw);
  return formatPhoneForInput(digits, withPlus);
}
