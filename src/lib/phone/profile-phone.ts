import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits, normalizePhoneE164 } from "@/lib/phone/normalize";

export function profilePhoneFields(phone: string) {
  const e164 = normalizePhoneE164(phone) ?? "";
  const digits = normalizePhoneDigits(phone);

  return {
    phone: e164 || phone.trim(),
    phone_digits: digits,
    phone_verified_at: digits.length >= 10 ? new Date().toISOString() : null,
  };
}

export async function assertPhoneAvailable(
  admin: SupabaseClient,
  phone: string,
  excludeUserId?: string,
) {
  const digits = normalizePhoneDigits(phone);

  if (digits.length < 10) {
    return "El número de teléfono no es válido.";
  }

  let profileQuery = admin.from("profiles").select("id").eq("phone_digits", digits);

  if (excludeUserId) {
    profileQuery = profileQuery.neq("id", excludeUserId);
  }

  const { data: profileHit } = await profileQuery.maybeSingle();

  if (profileHit?.id) {
    return "Ese número de celular ya está registrado en otra cuenta.";
  }

  let extraQuery = admin.from("profile_phones").select("profile_id").eq("phone_digits", digits);

  if (excludeUserId) {
    extraQuery = extraQuery.neq("profile_id", excludeUserId);
  }

  const { data: extraHit } = await extraQuery.maybeSingle();

  if (extraHit?.profile_id) {
    return "Ese número de celular ya está registrado en otra cuenta.";
  }

  return null;
}
