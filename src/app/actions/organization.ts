"use server";

import { revalidatePath } from "next/cache";
import { validateAvatarUpload } from "@/lib/account/profile-validation";
import { ORGANIZATION_LOGO_BUCKET } from "@/lib/organizations/branding";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createStorageSignedUrl } from "@/lib/supabase/storage-url";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { decodeAndSanitizeImage } from "@/lib/security/safe-image";
import {
  isAgencyModuleEnabled,
  parsePlanLimit,
  type OrganizationSettings,
} from "@/lib/organizations/settings";

export type OrganizationPlanUsage = {
  maxWarehouses: number | null;
  maxUsers: number | null;
  warehouseCount: number;
  userCount: number;
  extraUserCount: number;
  agenciesEnabled: boolean;
};

export async function getOrganizationPlanLimitsAction(): Promise<
  ActionResult<OrganizationPlanUsage>
> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const [{ data: org, error: orgError }, { count: warehouseCount }, { count: userCount }] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("settings")
          .eq("id", session.organizationId)
          .single(),
        supabase
          .from("warehouses")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", session.organizationId),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", session.organizationId),
      ]);

    if (orgError) {
      return fail(orgError.message);
    }

    const settings = (org?.settings || {}) as OrganizationSettings;
    const totalUsers = userCount || 0;

    return ok({
      maxWarehouses: parsePlanLimit(settings.max_warehouses),
      maxUsers: parsePlanLimit(settings.max_users),
      warehouseCount: warehouseCount || 0,
      userCount: totalUsers,
      extraUserCount: Math.max(0, totalUsers - 1),
      agenciesEnabled: isAgencyModuleEnabled(settings),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export type OrganizationProfile = {
  name: string;
  shortName: string;
  phone: string;
  logoUrl: string | null;
  canEdit: boolean;
};

export async function getOrganizationProfileAction(): Promise<
  ActionResult<OrganizationProfile>
> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: org, error } = await supabase
      .from("organizations")
      .select("name, settings")
      .eq("id", session.organizationId)
      .single();

    if (error) {
      return fail(error.message);
    }

    const settings = (org?.settings || {}) as OrganizationSettings;
    const logoPath = settings.company_logo_path?.trim() || "";
    const logoUrl = logoPath
      ? await createStorageSignedUrl(supabase, ORGANIZATION_LOGO_BUCKET, logoPath, {
          ownerId: session.organizationId,
        })
      : null;

    return ok({
      name: org?.name?.trim() || session.organizationName || "",
      shortName: settings.company_short_name?.trim() || "",
      phone: settings.company_phone?.trim() || "",
      logoUrl,
      canEdit: sessionHasPermission(session, "settings.manage"),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateOrganizationProfileAction(input: {
  name: string;
  shortName: string;
  phone: string;
}): Promise<ActionResult<OrganizationProfile>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "settings.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const name = input.name.trim();
    if (!name) {
      return fail("El nombre de la empresa es obligatorio.");
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", session.organizationId)
      .single();

    const phone = input.phone.trim();
    const shortName = input.shortName.trim();

    const nextSettings: OrganizationSettings = {
      ...((org?.settings || {}) as OrganizationSettings),
      company_phone: phone,
      company_short_name: shortName,
    };

    const { error } = await supabase
      .from("organizations")
      .update({
        name,
        settings: nextSettings,
      })
      .eq("id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    revalidatePath("/", "layout");

    const logoPath = nextSettings.company_logo_path?.trim() || "";
    const admin = createSupabaseAdminClient();
    const logoUrl = logoPath && admin
      ? await createStorageSignedUrl(admin, ORGANIZATION_LOGO_BUCKET, logoPath, {
          ownerId: session.organizationId,
        })
      : null;

    return ok({
      name,
      shortName,
      phone,
      logoUrl,
      canEdit: true,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function uploadOrganizationLogoAction(
  formData: FormData,
): Promise<ActionResult<{ logoUrl: string }>> {
  try {
    const file = formData.get("logo");
    if (!(file instanceof File)) {
      return fail("Elige un logo para subir");
    }

    const validationError = validateAvatarUpload(file);
    if (validationError) {
      return fail(validationError);
    }

    const session = await requireAppSession();

    if (!sessionHasPermission(session, "settings.manage")) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("No se pudo conectar con el almacenamiento");
    }

    const safeImage = await decodeAndSanitizeImage(file, { maxBytes: 4 * 1024 * 1024 });
    const path = `${session.organizationId}/logo.${safeImage.extension}`;
    const { error: uploadError } = await admin.storage.from(ORGANIZATION_LOGO_BUCKET).upload(path, safeImage.bytes, {
      cacheControl: "3600",
      contentType: safeImage.contentType,
      upsert: true,
    });
    if (uploadError) {
      return fail(uploadError.message);
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", session.organizationId)
      .single();

    const nextSettings: OrganizationSettings = {
      ...((org?.settings || {}) as OrganizationSettings),
      company_logo_path: path,
    };

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ settings: nextSettings })
      .eq("id", session.organizationId);

    if (updateError) {
      return fail(updateError.message);
    }

    const logoUrl = await createStorageSignedUrl(admin, ORGANIZATION_LOGO_BUCKET, path, {
      ownerId: session.organizationId,
    });
    revalidatePath("/", "layout");
    return ok({ logoUrl });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
