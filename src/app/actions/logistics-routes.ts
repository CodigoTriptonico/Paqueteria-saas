"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import {
  routeAddressForLogisticsTask,
  type LogisticsCustomerAddressRow,
} from "@/lib/logistics-address";
import { resolveRouteDateForTemplate } from "@/lib/logistics-route-week";
import { scheduledAtToLocalDateInput } from "@/lib/schedule-date";
import {
  hasRouteGeo,
  logisticsZoneKey,
  logisticsZoneLabel,
  statusAfterRouteUnassign,
  type LogisticsRouteRow,
  type LogisticsRouteStatus,
  type LogisticsRouteStopAddress,
  type LogisticsRouteStopRow,
  type LogisticsRouteTaskInput,
} from "@/lib/logistics-routing";
import {
  listShipmentsAction,
  type LogisticsTaskStatus,
  type ShipmentLogisticsTaskRow,
  type ShipmentRow,
} from "@/app/actions/shipments";
import { listLogisticsVehiclesAction } from "@/app/actions/logistics-fleet";
import { activeLogisticsRouteTaskIds } from "@/lib/logistics-view";
import { suggestVehicleIdForDriver } from "@/lib/logistics-route-vehicle";
import { canAutoCompleteRoute } from "@/lib/logistics-route-completion";
import {
  isLogisticsWeekdayKey,
  logisticsWeekdayKeys,
  type LogisticsWeekdayKey,
} from "@/lib/logistics-route-catalog";
import type { AppSession } from "@/lib/auth/types";

type Supabase = NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>;

export type LogisticsTaskAddressRow = {
  taskId: string;
  address: LogisticsRouteStopAddress;
  zoneKey: string;
  zoneLabel: string;
  hasGeo: boolean;
};

export type LogisticsRouteTemplateRow = {
  id: string;
  weekday: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type LogisticsRouteCatalog = {
  enabledDays: LogisticsWeekdayKey[];
  templates: LogisticsRouteTemplateRow[];
  defaultDriverByWeekday: Array<string | null>;
};

type LogisticsRouteTemplateDbRow = {
  id: string;
  weekday: number;
  name: string;
  created_at: string;
  updated_at: string;
};

type LogisticsRouteDbRow = {
  id: string;
  route_date: string;
  name: string;
  status: LogisticsRouteStatus;
  assigned_to: string | null;
  vehicle_id: string | null;
  warehouse_id: string | null;
  zone_key: string;
  route_template_id?: string | null;
  notes: string | null;
  published_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  logistics_route_stops?: LogisticsRouteStopDbRow[] | null;
};

type LogisticsRouteStopDbRow = {
  id: string;
  route_id: string;
  task_id: string;
  stop_order: number;
  address_snapshot: LogisticsRouteStopAddress | Record<string, unknown> | null;
  lat: number | string | null;
  lng: number | string | null;
  postal_code: string | null;
  city: string | null;
  outcome: "completed" | "failed" | "cancelled" | null;
  outcome_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
};

type LogisticsTaskDbRow = {
  id: string;
  status: LogisticsTaskStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  scheduled_at: string | null;
  schedule_confirmation_status?: "pending" | "confirmed" | null;
  schedule_kind: "exact" | "range" | "from" | null;
  window_start_at: string | null;
  window_end_at: string | null;
  shipment_id: string;
};

type LogisticsWeekdayDefaultDbRow = {
  weekday: number;
  default_driver_id: string | null;
};

const ROUTE_SELECT = `
  id, route_date, name, status, assigned_to, vehicle_id, warehouse_id, zone_key, route_template_id, notes, published_at, started_at, completed_at, created_at, updated_at,
  logistics_route_stops (
    id, route_id, task_id, stop_order, address_snapshot, lat, lng, postal_code, city, outcome, outcome_at, released_at, release_reason, created_at
  )
`;

function canManageRoutes(session: AppSession) {
  return (
    sessionHasPermission(session, "routes.update_status") ||
    sessionHasPermission(session, "sales.manage")
  );
}

function mapRouteTemplate(row: LogisticsRouteTemplateDbRow): LogisticsRouteTemplateRow {
  return {
    id: row.id,
    weekday: Number(row.weekday),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


function mapNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapStop(row: LogisticsRouteStopDbRow): LogisticsRouteStopRow {
  const snapshot =
    row.address_snapshot && typeof row.address_snapshot === "object"
      ? (row.address_snapshot as LogisticsRouteStopAddress)
      : ({} as LogisticsRouteStopAddress);

  return {
    id: row.id,
    routeId: row.route_id,
    taskId: row.task_id,
    order: Number(row.stop_order) || 0,
    address: snapshot,
    lat: mapNumber(row.lat),
    lng: mapNumber(row.lng),
    postalCode: row.postal_code || "",
    city: row.city || "",
    outcome: row.outcome,
    outcomeAt: row.outcome_at,
    releasedAt: row.released_at,
    releaseReason: row.release_reason || "",
    createdAt: row.created_at,
  };
}

function mapRoute(row: LogisticsRouteDbRow): LogisticsRouteRow {
  const stops = (row.logistics_route_stops || [])
    .map(mapStop)
    .filter((stop) => !stop.releasedAt)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));

  return {
    id: row.id,
    routeDate: row.route_date,
    name: row.name,
    status: row.status,
    assignedTo: row.assigned_to,
    vehicleId: row.vehicle_id,
    warehouseId: row.warehouse_id,
    zoneKey: row.zone_key || "",
    notes: row.notes || "",
    routeTemplateId: row.route_template_id || null,
    publishedAt: row.published_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stops,
  };
}

async function loadShipments() {
  const result = await listShipmentsAction();
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.data;
}

async function loadCustomerMap(
  supabase: Supabase,
  session: AppSession,
  shipments: ShipmentRow[],
) {
  const customerIds = Array.from(
    new Set(shipments.map((shipment) => shipment.customerId).filter((id): id is string => Boolean(id))),
  );

  if (!customerIds.length) {
    return new Map<string, LogisticsCustomerAddressRow>();
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, phones, street, house_number, address_reference, neighborhood, city, state, postal_code, country, place_id, formatted_address, lat, lng",
    )
    .eq("organization_id", session.organizationId)
    .in("id", customerIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data || []) as LogisticsCustomerAddressRow[]).map((customer) => [customer.id, customer]),
  );
}

async function loadRoutedTaskIds(supabase: Supabase, session: AppSession) {
  const { data, error } = await supabase
    .from("logistics_route_stops")
    .select("task_id")
    .eq("organization_id", session.organizationId)
    .is("released_at", null);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return new Set<string>();
    }

    throw new Error(error.message);
  }

  return new Set((data || []).map((row) => String(row.task_id)));
}

function isOpenTask(task: ShipmentLogisticsTaskRow) {
  return task.status !== "completed" && task.status !== "cancelled";
}

function taskInputFromShipment(
  shipment: ShipmentRow,
  task: ShipmentLogisticsTaskRow,
  customerById: Map<string, LogisticsCustomerAddressRow>,
): LogisticsRouteTaskInput {
  return {
    taskId: task.id,
    shipmentId: shipment.id,
    shipmentCode: shipment.code,
    customerName: shipment.customer_name,
    taskType: task.taskType,
    scheduledAt: task.scheduledAt,
    scheduleKind: task.scheduleKind || (task.scheduledAt ? "exact" : null),
    windowStartAt: task.windowStartAt || task.scheduledAt,
    windowEndAt: task.windowEndAt || null,
    warehouseId: task.warehouseId,
    assignedTo: task.assignedTo,
    address: routeAddressForLogisticsTask(
      {
        customerId: shipment.customerId,
        customerName: shipment.customer_name,
        recipientSnapshot: shipment.recipientSnapshot,
      },
      task.taskType,
      customerById,
    ),
  };
}

async function loadTaskInputs(
  supabase: Supabase,
  session: AppSession,
  options?: { excludeRouted?: boolean; onlyCurrentStep?: boolean },
) {
  const shipments = await loadShipments();
  const customerById = await loadCustomerMap(supabase, session, shipments);
  const routedIds = options?.excludeRouted
    ? await loadRoutedTaskIds(supabase, session)
    : new Set<string>();
  const currentTaskIds = options?.onlyCurrentStep
    ? activeLogisticsRouteTaskIds(shipments)
    : null;

  return shipments.flatMap((shipment) =>
    shipment.logisticsTasks
      .filter((task) => isOpenTask(task))
      .filter((task) => !routedIds.has(task.id))
      .filter((task) => !currentTaskIds || currentTaskIds.has(task.id))
      .map((task) => taskInputFromShipment(shipment, task, customerById)),
  );
}

async function loadRouteById(supabase: Supabase, session: AppSession, routeId: string) {
  const { data, error } = await supabase
    .from("logistics_routes")
    .select(ROUTE_SELECT)
    .eq("id", routeId)
    .eq("organization_id", session.organizationId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Ruta no encontrada");
  }

  return mapRoute(data as unknown as LogisticsRouteDbRow);
}

async function loadTaskRows(supabase: Supabase, session: AppSession, taskIds: string[]) {
  if (!taskIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("shipment_logistics_tasks")
    .select("id, status, assigned_to, assigned_at, scheduled_at, schedule_confirmation_status, schedule_kind, window_start_at, window_end_at, shipment_id")
    .eq("organization_id", session.organizationId)
    .in("id", taskIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as LogisticsTaskDbRow[];
}

function weekdayIndexForRouteDate(routeDate: string) {
  const date = new Date(`${routeDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (date.getDay() + 6) % 7;
}

async function defaultDriverForRouteDate(
  supabase: Supabase,
  session: AppSession,
  routeDate: string,
) {
  const weekday = weekdayIndexForRouteDate(routeDate);
  if (weekday === null) {
    return null;
  }

  const { data, error } = await supabase
    .from("logistics_weekday_defaults")
    .select("default_driver_id")
    .eq("organization_id", session.organizationId)
    .eq("weekday", weekday)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { default_driver_id?: string | null } | null)?.default_driver_id || null;
}

async function assertConductorProfile(
  supabase: Supabase,
  session: AppSession,
  driverId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, roles(slug)")
    .eq("id", driverId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Conductor no encontrado");
  }

  const rawRoles = (data as { roles?: { slug?: string | null } | Array<{ slug?: string | null }> | null }).roles;
  const role = Array.isArray(rawRoles) ? rawRoles[0] : rawRoles;
  if (role?.slug !== "conductor") {
    throw new Error("El usuario seleccionado no es conductor");
  }
}

async function syncRouteDriver(
  supabase: Supabase,
  session: AppSession,
  route: LogisticsRouteRow,
  assignedTo: string | null,
) {
  const tasks = await loadTaskRows(
    supabase,
    session,
    route.stops.map((stop) => stop.taskId),
  );

  for (const task of tasks) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let shouldUpdateShipment = false;

    if (assignedTo) {
      patch.assigned_to = assignedTo;
      shouldUpdateShipment = true;
      if (!task.assigned_at) {
        patch.assigned_at = new Date().toISOString();
      }
      if (["pending", "scheduled", "assigned"].includes(task.status)) {
        patch.status = "assigned";
      }
    } else if (task.assigned_to === route.assignedTo) {
      patch.assigned_to = null;
      patch.status = statusAfterRouteUnassign(task.status, task.scheduled_at);
      shouldUpdateShipment = true;
    } else {
      continue;
    }

    await supabase
      .from("shipment_logistics_tasks")
      .update(patch)
      .eq("id", task.id)
      .eq("organization_id", session.organizationId);

    if (shouldUpdateShipment) {
      await supabase
        .from("shipments")
        .update({ assigned_to: assignedTo })
        .eq("id", task.shipment_id)
        .eq("organization_id", session.organizationId);
    }
  }
}

async function insertStops(
  supabase: Supabase,
  session: AppSession,
  routeId: string,
  stops: LogisticsRouteTaskInput[],
  startOrder = 1,
) {
  if (!stops.length) {
    return;
  }

  const { error } = await supabase.from("logistics_route_stops").insert(
    stops.map((stop, index) => ({
      organization_id: session.organizationId,
      route_id: routeId,
      task_id: stop.taskId,
      stop_order: startOrder + index,
      address_snapshot: stop.address,
      lat: stop.address.lat,
      lng: stop.address.lng,
      postal_code: stop.address.postalCode,
      city: stop.address.city,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listLogisticsRouteCatalogAction(): Promise<ActionResult<LogisticsRouteCatalog>> {
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

    const [daysResult, templatesResult, defaultsResult] = await Promise.all([
      supabase.rpc("list_logistics_route_weekdays", { target_org_id: session.organizationId }),
      supabase
        .from("logistics_route_templates")
        .select("id, weekday, name, created_at, updated_at")
        .eq("organization_id", session.organizationId)
        .order("weekday", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("logistics_weekday_defaults")
        .select("weekday, default_driver_id")
        .eq("organization_id", session.organizationId),
    ]);

    if (daysResult.error) {
      return fail(daysResult.error.message);
    }

    if (templatesResult.error) {
      return fail(templatesResult.error.message);
    }

    const defaultDriverByWeekday = Array<string | null>(7).fill(null);
    if (!defaultsResult.error) {
      for (const row of (defaultsResult.data || []) as LogisticsWeekdayDefaultDbRow[]) {
        if (Number.isInteger(row.weekday) && row.weekday >= 0 && row.weekday <= 6) {
          defaultDriverByWeekday[row.weekday] = row.default_driver_id || null;
        }
      }
    }

    const enabledDays = (daysResult.data || []).filter(isLogisticsWeekdayKey);

    return ok({
      enabledDays,
      templates: ((templatesResult.data || []) as LogisticsRouteTemplateDbRow[]).map(mapRouteTemplate),
      defaultDriverByWeekday,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function setLogisticsWeekdayDefaultDriverAction(input: {
  weekday: number;
  driverId: string | null;
}): Promise<ActionResult<string | null>> {
  try {
    const session = await requireAppSession();
    if (!canManageRoutes(session)) throw new Error("FORBIDDEN");
    if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
      return fail("Dia de ruta invalido");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");

    const driverId = input.driverId || null;
    if (driverId) await assertConductorProfile(supabase, session, driverId);

    const { error } = await supabase
      .from("logistics_weekday_defaults")
      .upsert(
        {
          organization_id: session.organizationId,
          weekday: input.weekday,
          default_driver_id: driverId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,weekday" },
      );
    if (error) return fail(error.message);

    await recordActivityHistory(supabase, session, {
      action: "logistics.weekday_default_driver_changed",
      entityType: "logistics_weekday_default",
      entityId: `${session.organizationId}:${input.weekday}`,
      title: "Conductor predeterminado actualizado",
      description: logisticsWeekdayKeys[input.weekday] || "Dia de ruta",
      metadata: { weekday: input.weekday, driverId },
    });

    return ok(driverId);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function setLogisticsRouteWeekdayEnabledAction(input: {
  day: LogisticsWeekdayKey;
  enabled: boolean;
}): Promise<ActionResult<LogisticsWeekdayKey[]>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    if (!isLogisticsWeekdayKey(input.day)) {
      return fail("Dia de ruta invalido");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase.rpc("set_logistics_route_weekday_enabled", {
      target_org_id: session.organizationId,
      target_day: input.day,
      target_enabled: input.enabled,
    });

    if (error) {
      return fail(error.message);
    }

    const enabledDays = (data || []).filter(isLogisticsWeekdayKey);
    await recordActivityHistory(supabase, session, {
      action: "logistics.weekday_availability_changed",
      entityType: "organization_route_settings",
      entityId: session.organizationId,
      title: `${input.enabled ? "Dia habilitado" : "Dia deshabilitado"}: ${input.day}`,
      description: input.enabled
        ? "Disponible para dejar y recoger cajas"
        : "No disponible para dejar ni recoger cajas",
      metadata: { day: input.day, enabled: input.enabled },
    });

    return ok(enabledDays);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createLogisticsRouteTemplateAction(input: {
  weekday: number;
  name: string;
}): Promise<ActionResult<LogisticsRouteTemplateRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const name = input.name.trim();
    if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6 || !name) {
      return fail("Completa el nombre y el dia de la ruta");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("logistics_route_templates")
      .insert({
        organization_id: session.organizationId,
        weekday: input.weekday,
        name,
        created_by: session.userId,
      })
      .select("id, weekday, name, created_at, updated_at")
      .single();

    if (error || !data) {
      return fail(error?.code === "23505" ? "Ya existe una ruta con ese nombre para este dia" : error?.message || "No se pudo crear la ruta");
    }

    const template = mapRouteTemplate(data as LogisticsRouteTemplateDbRow);
    await recordActivityHistory(supabase, session, {
      action: "logistics.route_template_created",
      entityType: "logistics_route_template",
      entityId: template.id,
      title: `Ruta semanal creada: ${template.name}`,
      description: logisticsWeekdayKeys[template.weekday] || "Dia de ruta",
      metadata: { weekday: template.weekday },
    });

    return ok(template);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateLogisticsRouteTemplateAction(input: {
  templateId: string;
  name: string;
}): Promise<ActionResult<LogisticsRouteTemplateRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const name = input.name.trim();
    if (!input.templateId || !name) {
      return fail("El nombre de la ruta es obligatorio");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("logistics_route_templates")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", input.templateId)
      .eq("organization_id", session.organizationId)
      .select("id, weekday, name, created_at, updated_at")
      .single();

    if (error || !data) {
      return fail(error?.code === "23505" ? "Ya existe una ruta con ese nombre para este dia" : error?.message || "No se pudo actualizar la ruta");
    }

    const template = mapRouteTemplate(data as LogisticsRouteTemplateDbRow);
    await recordActivityHistory(supabase, session, {
      action: "logistics.route_template_updated",
      entityType: "logistics_route_template",
      entityId: template.id,
      title: `Ruta semanal actualizada: ${template.name}`,
      description: logisticsWeekdayKeys[template.weekday] || "Dia de ruta",
      metadata: { weekday: template.weekday },
    });

    return ok(template);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deleteLogisticsRouteTemplateAction(input: {
  templateId: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: current, error: currentError } = await supabase
      .from("logistics_route_templates")
      .select("id, weekday, name")
      .eq("id", input.templateId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (currentError || !current) {
      return fail(currentError?.message || "No se encontro la ruta semanal");
    }

    const { error } = await supabase
      .from("logistics_route_templates")
      .delete()
      .eq("id", input.templateId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    await recordActivityHistory(supabase, session, {
      action: "logistics.route_template_deleted",
      entityType: "logistics_route_template",
      entityId: current.id,
      title: `Ruta semanal eliminada: ${current.name}`,
      description: logisticsWeekdayKeys[Number(current.weekday)] || "Dia de ruta",
      metadata: { weekday: Number(current.weekday) },
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function confirmLogisticsTaskScheduleAction(input: {
  taskId: string;
  scheduledAt: string;
  driverId: string;
  routeTemplateId: string;
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();
    if (!canManageRoutes(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const routeDate = scheduledAtToLocalDateInput(input.scheduledAt);
    if (!input.taskId || !input.driverId || !input.routeTemplateId || !/^\d{4}-\d{2}-\d{2}$/.test(routeDate)) {
      return fail("Completa fecha, conductor y ruta");
    }
    const [{ data: template, error: templateError }, taskInputs] = await Promise.all([
      supabase.from("logistics_route_templates").select("id, weekday, name").eq("id", input.routeTemplateId).eq("organization_id", session.organizationId).single(),
      loadTaskInputs(supabase, session, { excludeRouted: true, onlyCurrentStep: true }),
    ]);
    if (templateError || !template) return fail("Ruta semanal no encontrada");
    await assertConductorProfile(supabase, session, input.driverId);
    const weekday = weekdayIndexForRouteDate(routeDate);
    if (weekday === null) return fail("Fecha invalida");
    if (Number(template.weekday) !== weekday) return fail("La ruta no corresponde al día elegido");
    const task = taskInputs.find((entry) => entry.taskId === input.taskId);
    if (!task) return fail("Tarea no disponible para programar");
    const { data: existing } = await supabase.from("logistics_routes").select(ROUTE_SELECT).eq("organization_id", session.organizationId).eq("route_template_id", input.routeTemplateId).eq("route_date", routeDate).neq("status", "cancelled").maybeSingle();
    let route = existing ? mapRoute(existing as unknown as LogisticsRouteDbRow) : null;
    if (!route) {
      const { data, error } = await supabase.from("logistics_routes").insert({ organization_id: session.organizationId, route_template_id: input.routeTemplateId, route_date: routeDate, name: template.name, status: "draft", assigned_to: input.driverId, zone_key: "", created_by: session.userId }).select(ROUTE_SELECT).single();
      if (error || !data) return fail(error?.message || "No se pudo crear la ruta operativa");
      route = mapRoute(data as unknown as LogisticsRouteDbRow);
    } else if (route.assignedTo && route.assignedTo !== input.driverId) {
      return fail("Esta ruta ya tiene otro conductor asignado");
    }
    if (!route.assignedTo) await syncRouteDriver(supabase, session, route, input.driverId);
    route = await loadRouteById(supabase, session, route.id);
    if (!route.stops.some((stop) => stop.taskId === task.taskId)) await insertStops(supabase, session, route.id, [task], Math.max(0, ...route.stops.map((stop) => stop.order)) + 1);
    const nowIso = new Date().toISOString();
    const { error: taskError } = await supabase
      .from("shipment_logistics_tasks")
      .update({
        scheduled_at: input.scheduledAt,
        schedule_kind: "exact",
        window_start_at: input.scheduledAt,
        window_end_at: null,
        assigned_to: input.driverId,
        assigned_at: nowIso,
        status: "assigned",
        schedule_confirmation_status: "confirmed",
        schedule_confirmed_at: nowIso,
        schedule_confirmed_by: session.userId,
        updated_at: nowIso,
      })
      .eq("id", input.taskId)
      .eq("organization_id", session.organizationId);
    if (taskError) return fail(taskError.message);

    await supabase
      .from("shipments")
      .update({ assigned_to: input.driverId })
      .eq("id", task.shipmentId)
      .eq("organization_id", session.organizationId);

    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_task_schedule_confirmed",
      entityType: "shipment",
      entityId: task.shipmentId,
      title: `Tarea confirmada: ${task.shipmentCode}`,
      description: `${route.name} - ${routeDate}`,
      metadata: {
        taskId: task.taskId,
        taskType: task.taskType,
        scheduledAt: input.scheduledAt,
        driverId: input.driverId,
        routeId: route.id,
        routeTemplateId: input.routeTemplateId,
      },
    });
    return ok(await loadRouteById(supabase, session, route.id));
  } catch (error) { return fail(actionErrorMessage(error)); }
}

export async function listLogisticsRoutesAction(): Promise<ActionResult<LogisticsRouteRow[]>> {
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
      .from("logistics_routes")
      .select(ROUTE_SELECT)
      .eq("organization_id", session.organizationId)
      .order("route_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.code === "42703") {
        return ok([]);
      }

      return fail(error.message);
    }

    return ok(((data || []) as unknown as LogisticsRouteDbRow[]).map(mapRoute));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listLogisticsTaskAddressesAction(): Promise<
  ActionResult<LogisticsTaskAddressRow[]>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const tasks = await loadTaskInputs(supabase, session);

    return ok(
      tasks.map((task) => ({
        taskId: task.taskId,
        address: task.address,
        zoneKey: logisticsZoneKey(task.address),
        zoneLabel: logisticsZoneLabel(task.address),
        hasGeo: hasRouteGeo(task.address),
      })),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}




export async function addLogisticsRouteStopAction(input: {
  routeId: string;
  taskId: string;
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const route = await loadRouteById(supabase, session, input.routeId);
    if (route.status !== "draft" && route.status !== "planned") {
      return fail("Solo puedes agregar tareas antes de iniciar la ruta");
    }

    const candidates = await loadTaskInputs(supabase, session, {
      excludeRouted: true,
      onlyCurrentStep: true,
    });
    const task = candidates.find((candidate) => candidate.taskId === input.taskId);

    if (!task) {
      return fail("Tarea no disponible");
    }

    if (!hasRouteGeo(task.address)) {
      return fail("Esta tarea no tiene geo");
    }

    const nextOrder = Math.max(0, ...route.stops.map((stop) => stop.order)) + 1;
    await insertStops(supabase, session, route.id, [task], nextOrder);
    let updated = await loadRouteById(supabase, session, route.id);

    if (route.assignedTo) {
      await syncRouteDriver(supabase, session, updated, route.assignedTo);
      updated = await loadRouteById(supabase, session, route.id);
    }

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function assignLogisticsTaskToRouteFromPickerAction(input: {
  taskId: string;
  routeId?: string | null;
  routeTemplateId?: string | null;
  routeDate?: string | null;
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const cleanRouteId = String(input.routeId || "").trim();
    const cleanTemplateId = String(input.routeTemplateId || "").trim();
    const cleanTaskId = String(input.taskId || "").trim();

    if (!cleanTaskId) {
      return fail("Falta tarea");
    }

    if (cleanRouteId && cleanTemplateId) {
      return fail("Selecciona solo una ruta");
    }

    if (!cleanRouteId && !cleanTemplateId) {
      return fail("Selecciona una ruta");
    }

    if (cleanRouteId) {
      return await addLogisticsRouteStopAction({
        routeId: cleanRouteId,
        taskId: cleanTaskId,
      });
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const taskInputs = await loadTaskInputs(supabase, session, {
      excludeRouted: true,
      onlyCurrentStep: true,
    });
    const task = taskInputs.find((entry) => entry.taskId === cleanTaskId);

    if (!task) {
      return fail("Tarea no disponible para asignar");
    }

    if (!hasRouteGeo(task.address)) {
      return fail("Esta tarea no tiene geo");
    }

    const anchorDate =
      scheduledAtToLocalDateInput(task.scheduledAt) ||
      String(input.routeDate || "").trim() ||
      "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
      return fail("La tarea necesita una fecha antes de asignar la ruta");
    }

    const { data: template, error: templateError } = await supabase
      .from("logistics_route_templates")
      .select("id, weekday, name")
      .eq("id", cleanTemplateId)
      .eq("organization_id", session.organizationId)
      .single();

    if (templateError || !template) {
      return fail("Ruta semanal no encontrada");
    }

    const routeDate = resolveRouteDateForTemplate(anchorDate, Number(template.weekday));

    const { data: taskRow } = await supabase
      .from("shipment_logistics_tasks")
      .select("assigned_to")
      .eq("id", cleanTaskId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    const driverId =
      (taskRow as { assigned_to?: string | null } | null)?.assigned_to ||
      (await defaultDriverForRouteDate(supabase, session, routeDate));

    if (!driverId) {
      return fail("Asigna un conductor a la tarea o define el conductor por defecto del día en Rutas");
    }

    await assertConductorProfile(supabase, session, driverId);

    const { data: existing } = await supabase
      .from("logistics_routes")
      .select(ROUTE_SELECT)
      .eq("organization_id", session.organizationId)
      .eq("route_template_id", cleanTemplateId)
      .eq("route_date", routeDate)
      .neq("status", "cancelled")
      .maybeSingle();

    let route = existing ? mapRoute(existing as unknown as LogisticsRouteDbRow) : null;

    if (!route) {
      const { data, error } = await supabase
        .from("logistics_routes")
        .insert({
          organization_id: session.organizationId,
          route_template_id: cleanTemplateId,
          route_date: routeDate,
          name: template.name,
          status: "draft",
          assigned_to: driverId,
          zone_key: "",
          created_by: session.userId,
        })
        .select(ROUTE_SELECT)
        .single();

      if (error || !data) {
        return fail(error?.message || "No se pudo crear la ruta operativa");
      }

      route = mapRoute(data as unknown as LogisticsRouteDbRow);
    } else if (route.assignedTo && route.assignedTo !== driverId) {
      return fail("Esta ruta ya tiene otro conductor asignado");
    }

    if (!route.assignedTo) {
      await syncRouteDriver(supabase, session, route, driverId);
      route = await loadRouteById(supabase, session, route.id);
    }

    if (route.status !== "draft" && route.status !== "planned") {
      return fail("Solo puedes agregar tareas antes de iniciar la ruta");
    }

    if (!route.stops.some((stop) => stop.taskId === task.taskId)) {
      const nextOrder = Math.max(0, ...route.stops.map((stop) => stop.order)) + 1;
      await insertStops(supabase, session, route.id, [task], nextOrder);
      route = await loadRouteById(supabase, session, route.id);
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from("shipment_logistics_tasks")
      .update({
        assigned_to: driverId,
        assigned_at: nowIso,
        status: "assigned",
        updated_at: nowIso,
      })
      .eq("id", cleanTaskId)
      .eq("organization_id", session.organizationId);

    await supabase
      .from("shipments")
      .update({ assigned_to: driverId })
      .eq("id", task.shipmentId)
      .eq("organization_id", session.organizationId);

    return ok(route);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function removeLogisticsRouteStopAction(input: {
  routeId: string;
  stopId: string;
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const route = await loadRouteById(supabase, session, input.routeId);
    if (route.status !== "draft" && route.status !== "planned") {
      return fail("Solo puedes quitar tareas antes de iniciar la ruta");
    }

    const stop = route.stops.find((entry) => entry.id === input.stopId);
    if (!stop) {
      return fail("Parada no encontrada");
    }

    const [task] = await loadTaskRows(supabase, session, [stop.taskId]);

    const { error } = await supabase
      .from("logistics_route_stops")
      .update({
        released_at: new Date().toISOString(),
        release_reason: "removed_before_departure",
        updated_at: new Date().toISOString(),
      })
      .eq("id", stop.id)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    if (task && route.assignedTo && task.assigned_to === route.assignedTo) {
      await supabase
        .from("shipment_logistics_tasks")
        .update({
          assigned_to: null,
          status: statusAfterRouteUnassign(task.status, task.scheduled_at),
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("organization_id", session.organizationId);

      await supabase
        .from("shipments")
        .update({ assigned_to: null })
        .eq("id", task.shipment_id)
        .eq("organization_id", session.organizationId);
    }

    return ok(await loadRouteById(supabase, session, route.id));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reorderLogisticsRouteStopsAction(input: {
  routeId: string;
  stopIds: string[];
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const route = await loadRouteById(supabase, session, input.routeId);
    if (route.status !== "draft") {
      return fail("Solo puedes ordenar paradas mientras la ruta esta en borrador");
    }
    const currentIds = new Set(route.stops.map((stop) => stop.id));

    if (input.stopIds.length !== route.stops.length || input.stopIds.some((id) => !currentIds.has(id))) {
      return fail("Orden invalido");
    }

    for (const [index, stopId] of input.stopIds.entries()) {
      await supabase
        .from("logistics_route_stops")
        .update({ stop_order: index + 1, updated_at: new Date().toISOString() })
        .eq("id", stopId)
        .eq("route_id", route.id)
        .eq("organization_id", session.organizationId);
    }

    return ok(await loadRouteById(supabase, session, route.id));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function assignLogisticsRouteDriverAction(input: {
  routeId: string;
  assignedTo: string | null;
  vehicleId?: string | null;
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    let route = await loadRouteById(supabase, session, input.routeId);
    if (route.status !== "draft") {
      return fail("Solo puedes cambiar el conductor mientras la ruta esta en borrador");
    }

    const assignedTo = input.assignedTo || null;
    let vehicleId = input.vehicleId ?? route.vehicleId;

    if (assignedTo && vehicleId === null) {
      const vehiclesResult = await listLogisticsVehiclesAction();
      if (vehiclesResult.ok) {
        vehicleId = suggestVehicleIdForDriver(vehiclesResult.data, assignedTo);
      }
    }

    const { error } = await supabase
      .from("logistics_routes")
      .update({
        assigned_to: assignedTo,
        vehicle_id: vehicleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", route.id)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    await syncRouteDriver(supabase, session, route, assignedTo);
    route = await loadRouteById(supabase, session, route.id);

    return ok(route);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function assignLogisticsRouteVehicleAction(input: {
  routeId: string;
  vehicleId: string | null;
}): Promise<ActionResult<LogisticsRouteRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const route = await loadRouteById(supabase, session, input.routeId);
    if (route.status !== "draft") {
      return fail("Solo puedes cambiar el vehiculo mientras la ruta esta en borrador");
    }

    const { error } = await supabase
      .from("logistics_routes")
      .update({
        vehicle_id: input.vehicleId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", route.id)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    return ok(await loadRouteById(supabase, session, route.id));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}


async function loadRouteTaskStatuses(
  supabase: Supabase,
  session: AppSession,
  taskIds: string[],
) {
  if (!taskIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("shipment_logistics_tasks")
    .select("id, status")
    .eq("organization_id", session.organizationId)
    .in("id", taskIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    taskId: String(row.id),
    status: row.status as LogisticsTaskStatus,
  }));
}

export async function tryAutoCompleteLogisticsRoute(
  supabase: Supabase,
  session: AppSession,
  routeId: string,
): Promise<boolean> {
  const route = await loadRouteById(supabase, session, routeId);

  if (route.status === "completed") {
    return false;
  }

  const taskStatuses = await loadRouteTaskStatuses(
    supabase,
    session,
    route.stops.map((stop) => stop.taskId),
  );

  if (!canAutoCompleteRoute(route, taskStatuses)) {
    return false;
  }

  const nowIso = new Date().toISOString();
  for (const taskStatus of taskStatuses) {
    await supabase
      .from("logistics_route_stops")
      .update({
        outcome: taskStatus.status === "completed" ? "completed" : "failed",
        outcome_at: nowIso,
        updated_at: nowIso,
      })
      .eq("route_id", route.id)
      .eq("task_id", taskStatus.taskId)
      .is("released_at", null)
      .eq("organization_id", session.organizationId);
  }

  const { error } = await supabase
    .from("logistics_routes")
    .update({
      status: "completed",
      completed_at: nowIso,
      completed_by: session.userId,
      updated_at: nowIso,
    })
    .eq("id", route.id)
    .eq("organization_id", session.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityHistory(supabase, session, {
    action: "logistics.route_completed",
    entityType: "logistics_route",
    entityId: route.id,
    title: `Ruta completada: ${route.name}`,
    description: `${route.routeDate} · ${route.stops.length} paradas cerradas`,
    metadata: {
      routeDate: route.routeDate,
      stopCount: route.stops.length,
      assignedTo: route.assignedTo,
      autoCompleted: true,
    },
  });

  return true;
}

export async function cancelLogisticsRouteAction(routeId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const route = await loadRouteById(supabase, session, routeId);
    if (route.status !== "draft" && route.status !== "planned") {
      return fail("Solo puedes cancelar rutas en borrador o enviadas");
    }

    await syncRouteDriver(supabase, session, route, null);

    const nowIso = new Date().toISOString();
    const { error: releaseStopsError } = await supabase
      .from("logistics_route_stops")
      .update({
        released_at: nowIso,
        release_reason: "route_cancelled",
        updated_at: nowIso,
      })
      .eq("route_id", route.id)
      .is("released_at", null)
      .eq("organization_id", session.organizationId);

    if (releaseStopsError) {
      return fail(releaseStopsError.message);
    }

    const { error } = await supabase
      .from("logistics_routes")
      .update({
        status: "cancelled",
        assigned_to: null,
        updated_at: nowIso,
      })
      .eq("id", route.id)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    await recordActivityHistory(supabase, session, {
      action: "logistics.route_cancelled",
      entityType: "logistics_route",
      entityId: route.id,
      title: `Ruta cancelada: ${route.name}`,
      description: `${route.routeDate} · ${route.stops.length} paradas liberadas`,
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
