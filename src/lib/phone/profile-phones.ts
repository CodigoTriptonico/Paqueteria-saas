import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits, normalizePhoneE164 } from "@/lib/phone/normalize";
import { profilePhoneFields } from "@/lib/phone/profile-phone";

export type ProfilePhoneLookup = {
  id: string;
  email: string;
  phone: string;
};

function uniquePhonesE164(phones: string[]) {
  const byDigits = new Map<string, string>();

  for (const raw of phones) {
    const e164 = normalizePhoneE164(raw) || raw.trim();
    const digits = normalizePhoneDigits(e164);

    if (digits.length < 10) {
      continue;
    }

    byDigits.set(digits, e164);
  }

  return Array.from(byDigits.entries()).map(([digits, phone]) => ({ digits, phone }));
}

/** Guarda el primero en profiles y el resto en profile_phones (todos válidos para recuperación). */
export async function syncProfileRecoveryPhones(
  admin: SupabaseClient,
  profileId: string,
  phones: string[],
) {
  const unique = uniquePhonesE164(phones);

  if (!unique.length) {
    return;
  }

  const [primary, ...additional] = unique;

  const { error: profileError } = await admin
    .from("profiles")
    .update(profilePhoneFields(primary.phone))
    .eq("id", profileId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  await admin.from("profile_phones").delete().eq("profile_id", profileId);

  if (!additional.length) {
    return;
  }

  const { error: insertError } = await admin.from("profile_phones").insert(
    additional.map((entry) => ({
      profile_id: profileId,
      ...profilePhoneFields(entry.phone),
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function findActiveProfileByPhone(
  admin: SupabaseClient,
  phone: string,
): Promise<ProfilePhoneLookup | null> {
  const digits = normalizePhoneDigits(phone);

  if (digits.length < 10) {
    return null;
  }

  const { data: profileMatch } = await admin
    .from("profiles")
    .select("id, email, phone")
    .eq("phone_digits", digits)
    .eq("is_active", true)
    .maybeSingle();

  if (profileMatch) {
    return profileMatch;
  }

  const { data: extraMatch } = await admin
    .from("profile_phones")
    .select("profile_id, phone")
    .eq("phone_digits", digits)
    .maybeSingle();

  if (!extraMatch?.profile_id) {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, phone, is_active")
    .eq("id", extraMatch.profile_id)
    .maybeSingle();

  if (!profile?.is_active) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    phone: extraMatch.phone || profile.phone,
  };
}

/** Supabase OTP solo envía al teléfono del usuario auth; lo alineamos si hace falta. */
export async function ensureAuthPhoneForOtp(
  admin: SupabaseClient,
  profileId: string,
  otpPhoneE164: string,
) {
  const { data: userData, error: readError } = await admin.auth.admin.getUserById(profileId);

  if (readError || !userData.user) {
    throw new Error(readError?.message || "No se encontró el usuario.");
  }

  if (userData.user.phone === otpPhoneE164) {
    return { swapped: false as const };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profileId, {
    phone: otpPhoneE164,
    phone_confirm: true,
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { swapped: true as const };
}

export async function restoreAuthPrimaryPhone(admin: SupabaseClient, profileId: string) {
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", profileId)
    .maybeSingle();

  const primaryPhone = profile?.phone?.trim();

  if (!primaryPhone) {
    return;
  }

  await admin.auth.admin.updateUserById(profileId, {
    phone: primaryPhone,
    phone_confirm: true,
  });
}
