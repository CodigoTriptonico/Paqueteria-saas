"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { confirmLogisticsTaskScheduleAction } from "@/app/actions/logistics-routes";
import { revokeCustomerRouteVerificationsForZoneChange } from "@/lib/customer-route-verifications-mutate";
import {
  customerHasRouteGeo,
  customerZoneKeyFromParts,
  resolveCustomerRouteAssignmentOutcome,
  type CustomerRouteAssignmentOutcome,
  type CustomerRouteAssignmentRequestStatus,
} from "@/lib/customer-route-verification";
import { getLogisticsWeekdayIndex } from "@/lib/logistics-route-week";
import { scheduledAtToLocalDateInput } from "@/lib/schedule-date";
import { customerRouteReplacementNote } from "@/lib/customer-route-replacement";
import { routeAddressFromCustomer } from "@/lib/logistics-address";
import {
  readBoxLinesFromLogisticsPlan,
  shipmentBoxLinesDetailLabel,
  type ShipmentBoxLine,
} from "@/lib/shipment-display";

type Supabase = NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>;

export type CustomerRouteAssignmentRequestRow = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  formattedAddress: string;
  addressReference: string;
  shipmentId: string;
  shipmentCode: string;
  taskId: string;
  taskType: string;
  routeTemplateId: string;
  routeTemplateName: string;
  routeWeekday: number;
  scheduledAt: string;
  driverId: string;
  driverLabel: string;
  zoneKey: string;
  boxLines: ShipmentBoxLine[];
  boxSummary: string;
  status: CustomerRouteAssignmentRequestStatus;
  requestedBy: string | null;
  createdAt: string;
  reviewNote: string;
};

export type CustomerRouteAssignmentResult = {
  outcome: CustomerRouteAssignmentOutcome;
  requestId: string | null;
  routeId: string | null;
};

function canProposeCustomerRoute(session: AppSession) {
  return (
    sessionHasPermission(session, "sales.manage") ||
    sessionHasPermission(session, "routes.update_status")
  );
}

function canReviewCustomerRoute(session: AppSession) {
  return sessionHasPermission(session, "routes.update_status");
}

function mapRequestRow(row: {
  id: string;
  customer_id: string;
  shipment_id: string;
  task_id: string;
  route_template_id: string;
  scheduled_at: string;
  driver_id: string | null;
  zone_key: string;
  status: string;
  requested_by: string | null;
  created_at: string;
  review_note: string;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phones?: string[] | null;
    street?: string | null;
    house_number?: string | null;
    address_reference?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    formatted_address?: string | null;
    lat?: number | string | null;
    lng?: number | string | null;
  } | null;
  shipment?: { code?: string | null; logistics_plan?: unknown } | null;
  task?: { task_type?: string | null } | null;
  template?: { name?: string | null; weekday?: number | null } | null;
  driver?: { full_name?: string | null; email?: string | null } | null;
}): CustomerRouteAssignmentRequestRow {
  const first = String(row.customer?.first_name || "").trim();
  const last = String(row.customer?.last_name || "").trim();
  const driverId = String(row.driver_id || "").trim();
  const address = routeAddressFromCustomer(
    row.customer
      ? {
          id: row.customer_id,
          ...row.customer,
        }
      : null,
  );
  const boxLines = readBoxLinesFromLogisticsPlan(row.shipment?.logistics_plan);
  const phones = Array.isArray(row.customer?.phones) ? row.customer.phones : [];

  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: [first, last].filter(Boolean).join(" ") || "Remitente",
    customerPhone: String(address?.phone || phones[0] || "").trim(),
    formattedAddress: String(address?.formattedAddress || "").trim() || "Sin dirección",
    addressReference: String(address?.addressReference || "").trim(),
    shipmentId: row.shipment_id,
    shipmentCode: String(row.shipment?.code || "").trim() || "—",
    taskId: row.task_id,
    taskType: String(row.task?.task_type || "").trim(),
    routeTemplateId: row.route_template_id,
    routeTemplateName: String(row.template?.name || "").trim() || "Ruta",
    routeWeekday: Number(row.template?.weekday ?? -1),
    scheduledAt: row.scheduled_at,
    driverId,
    driverLabel: driverId
      ? String(row.driver?.full_name || "").trim() ||
        String(row.driver?.email || "").trim() ||
        "Conductor"
      : "Sin conductor todavía",
    zoneKey: row.zone_key,
    boxLines,
    boxSummary: shipmentBoxLinesDetailLabel(boxLines) || "Sin cajas en el plan",
    status: row.status as CustomerRouteAssignmentRequestStatus,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    reviewNote: row.review_note || "",
  };
}

async function loadCustomerZone(
  supabase: Supabase,
  session: AppSession,
  customerId: string,
) {
  const { data, error } = await supabase
    .from("customers")
    .select("id, city, postal_code, lat, lng, first_name, last_name")
    .eq("id", customerId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Remitente no encontrado");
  }

  const zoneInput = {
    city: String(data.city || ""),
    postalCode: String(data.postal_code || ""),
    lat: data.lat == null ? null : Number(data.lat),
    lng: data.lng == null ? null : Number(data.lng),
  };

  return {
    customer: data,
    zoneInput,
    zoneKey: customerZoneKeyFromParts(zoneInput),
  };
}

async function loadActiveVerification(
  supabase: Supabase,
  session: AppSession,
  customerId: string,
  routeTemplateId: string,
) {
  const { data, error } = await supabase
    .from("customer_route_verifications")
    .select("id, customer_id, route_template_id, zone_key, ended_at")
    .eq("organization_id", session.organizationId)
    .eq("customer_id", customerId)
    .eq("route_template_id", routeTemplateId)
    .is("ended_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    customerId: data.customer_id as string,
    routeTemplateId: data.route_template_id as string,
    zoneKey: data.zone_key as string,
    endedAt: (data.ended_at as string | null) || null,
  };
}

async function upsertCustomerRouteVerification(input: {
  supabase: Supabase;
  session: AppSession;
  customerId: string;
  routeTemplateId: string;
  zoneKey: string;
}) {
  const nowIso = new Date().toISOString();
  const existing = await loadActiveVerification(
    input.supabase,
    input.session,
    input.customerId,
    input.routeTemplateId,
  );

  if (existing && existing.zoneKey === input.zoneKey) {
    return existing.id;
  }

  if (existing) {
    const { error: endError } = await input.supabase
      .from("customer_route_verifications")
      .update({
        ended_at: nowIso,
        end_reason: "Nueva verificación de ruta",
      })
      .eq("id", existing.id)
      .eq("organization_id", input.session.organizationId);

    if (endError) {
      throw new Error(endError.message);
    }
  }

  const { data, error } = await input.supabase
    .from("customer_route_verifications")
    .insert({
      organization_id: input.session.organizationId,
      customer_id: input.customerId,
      route_template_id: input.routeTemplateId,
      zone_key: input.zoneKey,
      verified_by: input.session.userId,
      verified_at: nowIso,
      started_at: nowIso,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No se pudo verificar la ruta del remitente");
  }

  return data.id as string;
}

export async function requestCustomerRouteAssignmentAction(input: {
  shipmentId: string;
  taskId: string;
  routeTemplateId: string;
  scheduledAt: string;
  driverId?: string | null;
}): Promise<ActionResult<CustomerRouteAssignmentResult>> {
  try {
    const session = await requireAppSession();
    if (!canProposeCustomerRoute(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const shipmentId = String(input.shipmentId || "").trim();
    const taskId = String(input.taskId || "").trim();
    const routeTemplateId = String(input.routeTemplateId || "").trim();
    let driverId = String(input.driverId || "").trim();
    const scheduledAt = String(input.scheduledAt || "").trim();
    const routeDate = scheduledAtToLocalDateInput(scheduledAt);

    if (!shipmentId || !taskId || !routeTemplateId || !/^\d{4}-\d{2}-\d{2}$/.test(routeDate)) {
      return fail("Completa fecha y ruta");
    }

    if (!driverId) {
      const { data: weekdayDefault } = await supabase
        .from("logistics_weekday_defaults")
        .select("default_driver_id")
        .eq("organization_id", session.organizationId)
        .eq("weekday", getLogisticsWeekdayIndex(routeDate))
        .maybeSingle();
      driverId = String(weekdayDefault?.default_driver_id || "").trim();
    }

    const [{ data: shipment, error: shipmentError }, { data: task, error: taskError }, { data: template, error: templateError }] =
      await Promise.all([
        supabase
          .from("shipments")
          .select("id, code, customer_id")
          .eq("id", shipmentId)
          .eq("organization_id", session.organizationId)
          .maybeSingle(),
        supabase
          .from("shipment_logistics_tasks")
          .select("id, shipment_id, task_type, status")
          .eq("id", taskId)
          .eq("organization_id", session.organizationId)
          .maybeSingle(),
        supabase
          .from("logistics_route_templates")
          .select("id, weekday, name")
          .eq("id", routeTemplateId)
          .eq("organization_id", session.organizationId)
          .maybeSingle(),
      ]);

    if (shipmentError || !shipment) {
      return fail(shipmentError?.message || "Envío no encontrado");
    }
    if (taskError || !task || task.shipment_id !== shipmentId) {
      return fail(taskError?.message || "Tarea no encontrada");
    }
    if (task.status === "completed" || task.status === "cancelled") {
      return fail("La tarea ya está cerrada");
    }
    if (templateError || !template) {
      return fail(templateError?.message || "Ruta semanal no encontrada");
    }

    const customerId = String(shipment.customer_id || "").trim();
    if (!customerId) {
      return fail("El envío no tiene remitente");
    }

    const weekday = getLogisticsWeekdayIndex(routeDate);
    if (Number(template.weekday) !== weekday) {
      return fail("La ruta no corresponde al día elegido");
    }

    const { zoneInput, zoneKey } = await loadCustomerZone(supabase, session, customerId);
    if (!customerHasRouteGeo(zoneInput) || zoneKey === "falta-geo") {
      return fail("El remitente necesita geo antes de asignar ruta");
    }

    const { data: existingStop } = await supabase
      .from("logistics_route_stops")
      .select("id")
      .eq("task_id", taskId)
      .is("released_at", null)
      .maybeSingle();

    if (existingStop) {
      return fail("Esta tarea ya está en una ruta");
    }

    const { data: pendingExisting } = await supabase
      .from("customer_route_assignment_requests")
      .select("id")
      .eq("task_id", taskId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingExisting) {
      return fail("Ya hay una solicitud pendiente de logística para esta tarea");
    }

    const verification = await loadActiveVerification(
      supabase,
      session,
      customerId,
      routeTemplateId,
    );
    const outcome = resolveCustomerRouteAssignmentOutcome({
      verification,
      routeTemplateId,
      currentZoneKey: zoneKey,
    });

    if (outcome === "assigned") {
      const assignResult = await confirmLogisticsTaskScheduleAction({
        taskId,
        scheduledAt,
        driverId: driverId || null,
        routeTemplateId,
      });
      if (!assignResult.ok) {
        return fail(assignResult.error);
      }

      await recordActivityHistory(supabase, session, {
        action: "customer.route_assignment.auto_accepted",
        entityType: "shipment",
        entityId: shipmentId,
        title: `Ruta autoasignada: ${shipment.code}`,
        description: `${template.name} · remitente verificado`,
        metadata: {
          taskId,
          routeTemplateId,
          driverId: driverId || null,
          zoneKey,
          routeId: assignResult.data.id,
        },
      });

      return ok({
        outcome: "assigned",
        requestId: null,
        routeId: assignResult.data.id,
      });
    }

    const nowIso = new Date().toISOString();
    const { error: taskScheduleError } = await supabase
      .from("shipment_logistics_tasks")
      .update({
        scheduled_at: scheduledAt,
        schedule_kind: "exact",
        window_start_at: scheduledAt,
        window_end_at: null,
        status: task.status === "pending" ? "scheduled" : task.status,
        updated_at: nowIso,
      })
      .eq("id", taskId)
      .eq("organization_id", session.organizationId);

    if (taskScheduleError) {
      return fail(taskScheduleError.message);
    }

    const { data: request, error: requestError } = await supabase
      .from("customer_route_assignment_requests")
      .insert({
        organization_id: session.organizationId,
        customer_id: customerId,
        shipment_id: shipmentId,
        task_id: taskId,
        route_template_id: routeTemplateId,
        scheduled_at: scheduledAt,
        driver_id: driverId || null,
        zone_key: zoneKey,
        status: "pending",
        requested_by: session.userId,
      })
      .select("id")
      .single();

    if (requestError || !request) {
      return fail(requestError?.message || "No se pudo crear la solicitud");
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.route_assignment.requested",
      entityType: "shipment",
      entityId: shipmentId,
      title: `Ruta pendiente de logística: ${shipment.code}`,
      description: `${template.name} · ${zoneKey}`,
      metadata: {
        requestId: request.id,
        taskId,
        routeTemplateId,
        driverId,
        zoneKey,
      },
    });

    return ok({
      outcome: "pending_approval",
      requestId: request.id as string,
      routeId: null,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listPendingCustomerRouteAssignmentRequestsAction(): Promise<
  ActionResult<CustomerRouteAssignmentRequestRow[]>
> {
  try {
    const session = await requireAppSession();
    if (
      !sessionHasPermission(session, "routes.view") &&
      !sessionHasPermission(session, "sales.manage")
    ) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customer_route_assignment_requests")
      .select(
        `
        id,
        customer_id,
        shipment_id,
        task_id,
        route_template_id,
        scheduled_at,
        driver_id,
        zone_key,
        status,
        requested_by,
        created_at,
        review_note,
        customer:customers!customer_route_assignment_requests_customer_id_fkey(
          first_name, last_name, phones, street, house_number, address_reference,
          neighborhood, city, state, postal_code, country, formatted_address, lat, lng
        ),
        shipment:shipments!customer_route_assignment_requests_shipment_id_fkey(code, logistics_plan),
        task:shipment_logistics_tasks!customer_route_assignment_requests_task_id_fkey(task_type),
        template:logistics_route_templates!customer_route_assignment_requests_route_template_id_fkey(name, weekday),
        driver:profiles!customer_route_assignment_requests_driver_id_fkey(full_name, email)
      `,
      )
      .eq("organization_id", session.organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      return fail(error.message);
    }

    return ok(((data || []) as Array<Parameters<typeof mapRequestRow>[0]>).map(mapRequestRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listPendingCustomerRouteAssignmentTaskIdsAction(): Promise<
  ActionResult<string[]>
> {
  try {
    const session = await requireAppSession();
    if (
      !sessionHasPermission(session, "routes.view") &&
      !sessionHasPermission(session, "sales.manage")
    ) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customer_route_assignment_requests")
      .select("task_id")
      .eq("organization_id", session.organizationId)
      .eq("status", "pending");

    if (error) {
      return fail(error.message);
    }

    return ok((data || []).map((row) => String(row.task_id)));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reviewCustomerRouteAssignmentRequestAction(input: {
  requestId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<ActionResult<{ routeId: string | null }>> {
  try {
    const session = await requireAppSession();
    if (!canReviewCustomerRoute(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const requestId = String(input.requestId || "").trim();
    if (!requestId || (input.decision !== "approved" && input.decision !== "rejected")) {
      return fail("Solicitud inválida");
    }

    const { data: request, error: requestError } = await supabase
      .from("customer_route_assignment_requests")
      .select(
        "id, customer_id, shipment_id, task_id, route_template_id, scheduled_at, driver_id, zone_key, status",
      )
      .eq("id", requestId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (requestError || !request) {
      return fail(requestError?.message || "Solicitud no encontrada");
    }
    if (request.status !== "pending") {
      return fail("La solicitud ya fue revisada");
    }

    const nowIso = new Date().toISOString();
    const reviewNote = String(input.note || "").trim();

    if (input.decision === "rejected") {
      const { error: updateError } = await supabase
        .from("customer_route_assignment_requests")
        .update({
          status: "rejected",
          reviewed_by: session.userId,
          reviewed_at: nowIso,
          review_note: reviewNote,
          updated_at: nowIso,
        })
        .eq("id", requestId)
        .eq("organization_id", session.organizationId);

      if (updateError) {
        return fail(updateError.message);
      }

      await recordActivityHistory(supabase, session, {
        action: "customer.route_assignment.rejected",
        entityType: "shipment",
        entityId: request.shipment_id,
        title: "Asignación de ruta rechazada",
        description: reviewNote || "Logística rechazó la ruta propuesta",
        metadata: { requestId, taskId: request.task_id },
      });

      return ok({ routeId: null });
    }

    const { zoneKey: currentZoneKey, zoneInput } = await loadCustomerZone(
      supabase,
      session,
      request.customer_id,
    );
    if (!customerHasRouteGeo(zoneInput) || currentZoneKey === "falta-geo") {
      return fail("El remitente necesita geo antes de aprobar");
    }
    if (currentZoneKey !== request.zone_key) {
      return fail("La zona del remitente cambió; el vendedor debe volver a proponer la ruta");
    }

    const routeDate = scheduledAtToLocalDateInput(request.scheduled_at);
    let assignDriverId = String(request.driver_id || "").trim();
    if (!assignDriverId) {
      const { data: weekdayDefault } = await supabase
        .from("logistics_weekday_defaults")
        .select("default_driver_id")
        .eq("organization_id", session.organizationId)
        .eq("weekday", getLogisticsWeekdayIndex(routeDate))
        .maybeSingle();
      assignDriverId = String(weekdayDefault?.default_driver_id || "").trim();
    }

    const assignResult = await confirmLogisticsTaskScheduleAction({
      taskId: request.task_id,
      scheduledAt: request.scheduled_at,
      driverId: assignDriverId || null,
      routeTemplateId: request.route_template_id,
    });
    if (!assignResult.ok) {
      return fail(assignResult.error);
    }

    await upsertCustomerRouteVerification({
      supabase,
      session,
      customerId: request.customer_id,
      routeTemplateId: request.route_template_id,
      zoneKey: currentZoneKey,
    });

    const { error: updateError } = await supabase
      .from("customer_route_assignment_requests")
      .update({
        status: "approved",
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        review_note: reviewNote,
        updated_at: nowIso,
      })
      .eq("id", requestId)
      .eq("organization_id", session.organizationId);

    if (updateError) {
      return fail(updateError.message);
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.route_assignment.approved",
      entityType: "shipment",
      entityId: request.shipment_id,
      title: "Asignación de ruta aprobada",
      description: `Remitente verificado · ${assignResult.data.name}`,
      metadata: {
        requestId,
        taskId: request.task_id,
        routeId: assignResult.data.id,
        zoneKey: currentZoneKey,
      },
    });

    return ok({ routeId: assignResult.data.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function replaceCustomerRouteAssignmentRequestAction(input: {
  requestId: string;
  routeTemplateId: string;
  scheduledAt: string;
  driverId?: string | null;
  note?: string;
}): Promise<ActionResult<{ routeId: string }>> {
  try {
    const session = await requireAppSession();
    if (!canReviewCustomerRoute(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const requestId = String(input.requestId || "").trim();
    const routeTemplateId = String(input.routeTemplateId || "").trim();
    let driverId = String(input.driverId || "").trim();
    const scheduledAt = String(input.scheduledAt || "").trim();
    const routeDate = scheduledAtToLocalDateInput(scheduledAt);

    if (!requestId || !routeTemplateId || !/^\d{4}-\d{2}-\d{2}$/.test(routeDate)) {
      return fail("Completa la ruta y la fecha de reemplazo");
    }

    const { data: request, error: requestError } = await supabase
      .from("customer_route_assignment_requests")
      .select(
        "id, customer_id, shipment_id, task_id, route_template_id, scheduled_at, driver_id, zone_key, status",
      )
      .eq("id", requestId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (requestError || !request) {
      return fail(requestError?.message || "Solicitud no encontrada");
    }
    if (request.status !== "pending") {
      return fail("La solicitud ya fue revisada");
    }

    const [{ data: oldTemplate }, { data: newTemplate, error: templateError }] = await Promise.all([
      supabase
        .from("logistics_route_templates")
        .select("id, name")
        .eq("id", request.route_template_id)
        .eq("organization_id", session.organizationId)
        .maybeSingle(),
      supabase
        .from("logistics_route_templates")
        .select("id, name, weekday")
        .eq("id", routeTemplateId)
        .eq("organization_id", session.organizationId)
        .maybeSingle(),
    ]);

    if (templateError || !newTemplate) {
      return fail(templateError?.message || "Ruta semanal no encontrada");
    }

    if (Number(newTemplate.weekday) !== getLogisticsWeekdayIndex(routeDate)) {
      return fail("La ruta de reemplazo no corresponde al día elegido");
    }

    const { zoneKey: currentZoneKey, zoneInput } = await loadCustomerZone(
      supabase,
      session,
      request.customer_id,
    );
    if (!customerHasRouteGeo(zoneInput) || currentZoneKey === "falta-geo") {
      return fail("El remitente necesita geo antes de cambiar la ruta");
    }
    if (currentZoneKey !== request.zone_key) {
      return fail("La zona del remitente cambió; el vendedor debe volver a proponer la ruta");
    }

    if (!driverId) {
      const { data: weekdayDefault } = await supabase
        .from("logistics_weekday_defaults")
        .select("default_driver_id")
        .eq("organization_id", session.organizationId)
        .eq("weekday", getLogisticsWeekdayIndex(routeDate))
        .maybeSingle();
      driverId = String(weekdayDefault?.default_driver_id || "").trim();
    }

    const assignResult = await confirmLogisticsTaskScheduleAction({
      taskId: request.task_id,
      scheduledAt,
      driverId: driverId || null,
      routeTemplateId,
    });
    if (!assignResult.ok) {
      return fail(assignResult.error);
    }

    await upsertCustomerRouteVerification({
      supabase,
      session,
      customerId: request.customer_id,
      routeTemplateId,
      zoneKey: currentZoneKey,
    });

    const nowIso = new Date().toISOString();
    const reviewNote =
      String(input.note || "").trim() ||
      customerRouteReplacementNote(
        String(oldTemplate?.name || "propuesta"),
        String(newTemplate.name || "nueva ruta"),
      );

    const { error: updateError } = await supabase
      .from("customer_route_assignment_requests")
      .update({
        status: "rejected",
        reviewed_by: session.userId,
        reviewed_at: nowIso,
        review_note: reviewNote,
        updated_at: nowIso,
      })
      .eq("id", requestId)
      .eq("organization_id", session.organizationId);

    if (updateError) {
      return fail(updateError.message);
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.route_assignment.replaced",
      entityType: "shipment",
      entityId: request.shipment_id,
      title: "Ruta propuesta reemplazada por logística",
      description: reviewNote,
      metadata: {
        requestId,
        taskId: request.task_id,
        previousRouteTemplateId: request.route_template_id,
        routeTemplateId,
        routeId: assignResult.data.id,
        zoneKey: currentZoneKey,
        driverId,
      },
    });

    return ok({ routeId: assignResult.data.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
