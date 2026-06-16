const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_PHONE_COUNTRY_CODE?.replace(/\D/g, "") || "1";

/** ITU-T E.164 maximum length (digits only, country code included). */
export const PHONE_MAX_DIGITS = 15;

export const PHONE_MIN_DIGITS = 10;

export function normalizePhoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function isValidPhone(phone: string) {
  const digits = normalizePhoneDigits(phone);
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

/** E.164 for Supabase Auth SMS (+country + number). */
export function normalizePhoneE164(phone: string) {
  const trimmed = phone.trim();
  const digits = normalizePhoneDigits(trimmed);

  if (digits.length < 10) {
    return null;
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function formatPhoneHint(phone: string) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 4) {
    return phone;
  }

  const tail = digits.slice(-4);
  return `***${tail}`;
}
