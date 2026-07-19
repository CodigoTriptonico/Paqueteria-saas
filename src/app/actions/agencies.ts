"use server";

import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { captorAgencyLimitMessage, isCaptorAgencyLimitError } from "@/lib/agency-captor-limit";
import { agencyDemoTeamErrorMessage } from "@/lib/agency-demo-team";
import { deleteAuthUserSafely } from "@/lib/security/auth-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePersonName } from "@/lib/person-name";

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
  routeTemplateId?: string;
  routeProposal?: { name: string; weekday: number; note?: string };
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
    const routeTemplateId = input.routeTemplateId?.trim() || "";
    const routeProposal = input.routeProposal && input.routeProposal.name.trim()
      ? { name: input.routeProposal.name.trim(), weekday: Number(input.routeProposal.weekday), note: input.routeProposal.note?.trim() || "" }
      : null;

    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(administratorEmail) || administratorPassword.length < 8 || (!routeTemplateId && !routeProposal)) {
      return fail("Completa los datos de la agencia y selecciona o solicita una ruta.");
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
      owner_name: input.administratorFullName
        ? normalizePersonName(input.administratorFullName) || null
        : null,
      org_slug: null,
      org_kind: "client",
      owner_phone: null,
    });

    if (bootstrapError || !organizationId) {
      throw new Error(bootstrapError?.message || "No se pudo preparar la agencia.");
    }

    createdOrganizationId = organizationId as string;

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("tenant_id")
      .eq("id", createdOrganizationId)
      .single();
    if (organizationError || !organization?.tenant_id) {
      throw new Error(organizationError?.message || "No se encontró el tenant de la agencia.");
    }

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

    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("user_id", session.userId)
      .eq("status", "active")
      .is("ended_at", null)
      .maybeSingle();
    if (membershipError || !membership) throw new Error(membershipError?.message || "No se encontró la membresía del captador.");

    if (routeTemplateId) {
      const { data: template, error: templateError } = await admin
        .from("logistics_route_templates")
        .select("id")
        .eq("id", routeTemplateId)
        .eq("organization_id", session.organizationId)
        .maybeSingle();
      if (templateError || !template) throw new Error("La ruta seleccionada no existe.");
      const { error: assignmentError } = await admin.from("agency_default_route_assignments").insert({
        tenant_id: organization.tenant_id,
        organization_id: createdOrganizationId,
        agency_id: agencyId as string,
        route_template_id: routeTemplateId,
        assigned_by_membership_id: membership.id,
        reason: "Ruta elegida al crear la agencia",
      });
      if (assignmentError) throw new Error(assignmentError.message);
    } else if (routeProposal) {
      if (!Number.isInteger(routeProposal.weekday) || routeProposal.weekday < 0 || routeProposal.weekday > 6) {
        throw new Error("Selecciona un día válido para la ruta propuesta.");
      }
      const { error: proposalError } = await admin.from("agency_route_proposals").insert({
        tenant_id: organization.tenant_id,
        agency_id: agencyId as string,
        organization_id: createdOrganizationId,
        name: routeProposal.name,
        weekday: routeProposal.weekday,
        note: routeProposal.note,
      });
      if (proposalError) throw new Error(proposalError.message);
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

export async function listCaptorRouteTemplatesAction(): Promise<ActionResult<Array<{ id: string; name: string; weekday: number }>>> {
  try {
    const session = await requireAppSession();
    if (session.roleSlug !== "captador_agencias" || !sessionHasPermission(session, "agency.create")) throw new Error("FORBIDDEN");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase no configurado");
    const { data, error } = await admin
      .from("logistics_route_templates")
      .select("id, name, weekday")
      .eq("organization_id", session.organizationId)
      .order("weekday")
      .order("name");
    if (error) throw new Error(error.message);
    return ok((data || []).map((row) => ({ id: row.id, name: row.name, weekday: Number(row.weekday) })));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export type AgencyRouteProposal = { id: string; agencyId: string; agencyName: string; name: string; weekday: number; note: string };

export async function listAgencyRouteProposalsAction(): Promise<ActionResult<AgencyRouteProposal[]>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.assign")) throw new Error("FORBIDDEN");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase no configurado");
    const { data: proposals, error } = await admin
      .from("agency_route_proposals")
      .select("id, agency_id, name, weekday, note")
      .eq("status", "pending")
      .order("created_at");
    if (error) throw new Error(error.message);
    const agencyIds = [...new Set((proposals || []).map((proposal) => proposal.agency_id))];
    if (!agencyIds.length) return ok([]);
    const { data: agencies, error: agencyError } = await admin
      .from("agencies")
      .select("id, matrix_organization_id, organization_id")
      .in("id", agencyIds)
      .eq("matrix_organization_id", session.organizationId);
    if (agencyError) throw new Error(agencyError.message);
    const agencyById = new Map((agencies || []).map((agency) => [agency.id, agency]));
    const organizationIds = [...new Set((agencies || []).map((agency) => agency.organization_id))];
    const { data: organizations, error: organizationError } = organizationIds.length
      ? await admin.from("organizations").select("id, name").in("id", organizationIds)
      : { data: [], error: null };
    if (organizationError) throw new Error(organizationError.message);
    const nameByOrganizationId = new Map((organizations || []).map((organization) => [organization.id, organization.name]));
    return ok((proposals || []).flatMap((proposal) => {
      const agency = agencyById.get(proposal.agency_id);
      if (!agency) return [];
      return [{ id: proposal.id, agencyId: proposal.agency_id, agencyName: nameByOrganizationId.get(agency.organization_id) || "Agencia", name: proposal.name, weekday: Number(proposal.weekday), note: proposal.note || "" }];
    }));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reviewAgencyRouteProposalAction(input: { proposalId: string; decision: "approved" | "rejected"; routeTemplateId?: string; note?: string }): Promise<ActionResult<{ routeTemplateId: string | null }>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "agency.requests.assign")) throw new Error("FORBIDDEN");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase no configurado");
    const { data: proposal, error: proposalError } = await admin.from("agency_route_proposals").select("id, tenant_id, agency_id, organization_id, name, weekday, status").eq("id", input.proposalId).maybeSingle();
    if (proposalError || !proposal || proposal.status !== "pending") throw new Error("La propuesta ya no está pendiente.");
    const { data: agency, error: agencyError } = await admin.from("agencies").select("id").eq("id", proposal.agency_id).eq("matrix_organization_id", session.organizationId).maybeSingle();
    if (agencyError || !agency) throw new Error("FORBIDDEN");
    const { data: membership, error: membershipError } = await admin.from("organization_memberships").select("id").eq("organization_id", session.organizationId).eq("user_id", session.userId).eq("status", "active").is("ended_at", null).maybeSingle();
    if (membershipError || !membership) throw new Error(membershipError?.message || "No se encontró la membresía de logística.");
    let routeTemplateId: string | null = null;
    if (input.decision === "approved") {
      routeTemplateId = input.routeTemplateId || null;
      if (routeTemplateId) {
        const { data: template, error: templateError } = await admin.from("logistics_route_templates").select("id").eq("id", routeTemplateId).eq("organization_id", session.organizationId).maybeSingle();
        if (templateError || !template) throw new Error("La ruta elegida no existe.");
      } else {
        const { data: createdTemplate, error: createTemplateError } = await admin.from("logistics_route_templates").insert({ organization_id: session.organizationId, name: proposal.name, weekday: proposal.weekday }).select("id").single();
        if (createTemplateError || !createdTemplate) throw new Error(createTemplateError?.message || "No se pudo crear la ruta.");
        routeTemplateId = createdTemplate.id;
      }
      await admin.from("agency_default_route_assignments").update({ ended_at: new Date().toISOString() }).eq("agency_id", proposal.agency_id).is("ended_at", null);
      const { error: assignmentError } = await admin.from("agency_default_route_assignments").insert({ tenant_id: proposal.tenant_id, organization_id: proposal.organization_id, agency_id: proposal.agency_id, route_template_id: routeTemplateId, assigned_by_membership_id: membership.id, reason: "Ruta aprobada por logística" });
      if (assignmentError) throw new Error(assignmentError.message);
    }
    const { error: updateError } = await admin.from("agency_route_proposals").update({ status: input.decision, reviewed_by_membership_id: membership.id, reviewed_at: new Date().toISOString(), review_note: input.note?.trim() || "" }).eq("id", proposal.id);
    if (updateError) throw new Error(updateError.message);
    revalidatePath("/logistica");
    return ok({ routeTemplateId });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
