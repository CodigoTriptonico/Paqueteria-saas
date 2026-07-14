const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_PHONE_COUNTRY_CODE?.replace(/\D/g, "") || "1";

/** ITU-T E.164 maximum length (digits only, country code included). */
export const PHONE_MAX_DIGITS = 15;


export function normalizePhoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
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
