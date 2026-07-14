import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits, normalizePhoneE164 } from "@/lib/phone/normalize";
import { profilePhoneFields } from "@/lib/phone/profile-phone";

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
