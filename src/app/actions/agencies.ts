"use server";

import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { captorAgencyLimitMessage, isCaptorAgencyLimitError } from "@/lib/agency-captor-limit";
import { agencyDemoTeamErrorMessage } from "@/lib/agency-demo-team";
import { deleteAuthUserSafely } from "@/lib/security/auth-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function agencyActionErrorMessage(message: string) {
  if (isCaptorAgencyLimitError(message)) {
    return captorAgencyLimitMessage();
  }

  return agencyDemoTeamErrorMessage(message);
}

export async function createCaptorAgencyAction(input: {
  name: string;
  administratorEmail: string;
  administratorPassword: string;
  administratorFullName?: string;
}): Promise<ActionResult<{ agencyId: string }>> {
  let createdUserId: string | null = null;
  let createdOrganizationId: string | null = null;

  try {
    const session = await requireAppSession();
    if (session.roleSlug !== "captador_agencias" || !sessionHasPermission(session, "agency.create")) {
      throw new Error("FORBIDDEN");
    }

    const name = input.name.trim();
    const administratorEmail = input.administratorEmail.trim().toLowerCase();
    const administratorPassword = input.administratorPassword;

    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(administratorEmail) || administratorPassword.length < 8) {
      return fail("Completa el nombre, correo y una contraseña de al menos 8 caracteres.");
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }

    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: administratorEmail,
      password: administratorPassword,
      email_confirm: true,
    });

    if (createUserError || !createdUser.user) {
      return fail(createUserError?.message || "No se pudo crear el administrador de la agencia.");
    }

    createdUserId = createdUser.user.id;

    const { data: organizationId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: name,
      owner_id: createdUserId,
      owner_email: administratorEmail,
      owner_name: input.administratorFullName?.trim() || null,
      org_slug: null,
      org_kind: "client",
      owner_phone: null,
    });

    if (bootstrapError || !organizationId) {
      throw new Error(bootstrapError?.message || "No se pudo preparar la agencia.");
    }

    createdOrganizationId = organizationId as string;

    const { data: agencyId, error: initializeError } = await admin.rpc(
      "initialize_captor_agency_organization",
      {
        target_organization_id: createdOrganizationId,
        target_matrix_organization_id: session.organizationId,
        target_captor_user_id: session.userId,
        target_owner_user_id: createdUserId,
      },
    );

    if (initializeError || !agencyId) {
      throw new Error(initializeError?.message || "No se pudo dar de alta la agencia.");
    }

    revalidatePath("/captacion");
    revalidatePath("/agencias");
    return ok({ agencyId: agencyId as string });
  } catch (error) {
    if (createdUserId) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        await deleteAuthUserSafely(admin, createdUserId);
        if (createdOrganizationId) {
          await admin.from("organizations").delete().eq("id", createdOrganizationId);
        }
      }
    }

    return fail(agencyActionErrorMessage(actionErrorMessage(error)));
  }
}
