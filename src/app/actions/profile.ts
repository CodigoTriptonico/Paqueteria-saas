"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions/errors";
import { requireAppSession } from "@/lib/auth/session";
import {
  PROFILE_AVATAR_BUCKET,
  validateAvatarUpload,
  validateNewPassword,
  validateProfileName,
} from "@/lib/account/profile-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStorageSignedUrl } from "@/lib/supabase/storage-url";
import { normalizePersonName } from "@/lib/person-name";
import { decodeAndSanitizeImage } from "@/lib/security/safe-image";

function refreshAccountSurfaces() {
  revalidatePath("/", "layout");
  revalidatePath("/perfil");
}

export async function updateMyProfileAction(
  fullName: string,
): Promise<ActionResult<{ fullName: string }>> {
  try {
    const validationError = validateProfileName(fullName);
    if (validationError) {
      return fail(validationError);
    }

    const session = await requireAppSession();
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("No se pudo conectar con la cuenta");
    }

    const normalizedName = normalizePersonName(fullName);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: normalizedName })
      .eq("id", session.userId);

    if (error) {
      return fail(error.message);
    }

    refreshAccountSurfaces();
    return ok({ fullName: normalizedName });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo actualizar el perfil");
  }
}

export async function changeMyPasswordAction(input: {
  currentPassword: string;
  nextPassword: string;
  confirmation: string;
}): Promise<ActionResult<null>> {
  try {
    const validationError = validateNewPassword(
      input.currentPassword,
      input.nextPassword,
      input.confirmation,
    );
    if (validationError) {
      return fail(validationError);
    }

    const session = await requireAppSession();
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return fail("No se pudo conectar con la cuenta");
    }

    const { data: verified, error: verificationError } = await supabase.auth.signInWithPassword({
      email: session.email,
      password: input.currentPassword,
    });

    if (verificationError || verified.user?.id !== session.userId) {
      return fail("La contraseña actual no es correcta");
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password: input.nextPassword,
    });
    if (passwordError) {
      return fail(passwordError.message);
    }

    refreshAccountSurfaces();
    return ok(null);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo cambiar la contraseña");
  }
}

export async function uploadMyProfileAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
  try {
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return fail("Elige una foto para subir");
    }

    const validationError = validateAvatarUpload(file);
    if (validationError) {
      return fail(validationError);
    }

    const session = await requireAppSession();
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("No se pudo conectar con el almacenamiento");
    }

    const safeImage = await decodeAndSanitizeImage(file, { maxBytes: 4 * 1024 * 1024 });
    const path = `${session.userId}/avatar.${safeImage.extension}`;
    const { error: uploadError } = await admin.storage.from(PROFILE_AVATAR_BUCKET).upload(path, safeImage.bytes, {
      cacheControl: "3600",
      contentType: safeImage.contentType,
      upsert: true,
    });
    if (uploadError) {
      return fail(uploadError.message);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", session.userId);
    if (profileError) {
      return fail(profileError.message);
    }

    const avatarUrl = await createStorageSignedUrl(admin, PROFILE_AVATAR_BUCKET, path, {
      ownerId: session.userId,
    });
    refreshAccountSurfaces();
    return ok({ avatarUrl });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo subir la foto");
  }
}
