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
import {
  hasRouteGeo,
  logisticsZoneKey,
  logisticsZoneLabel,
  orderStopsByProximity,
  statusAfterRouteUnassign,
  suggestLogisticsRoutes,
  type LogisticsRouteRow,
  type LogisticsRouteStatus,
  type LogisticsRouteStopAddress,
  type LogisticsRouteStopRow,
  type LogisticsRouteSuggestion,
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
import { pickFleetCargoCapacityLimit } from "@/lib/logistics-route-capacity";
import { mapLogisticsEvidenceFromHistory } from "@/lib/logistics-evidence";
import { suggestVehicleIdForDriver } from "@/lib/logistics-route-vehicle";
import {
  canAutoCompleteRoute,
  routeCompletionBlockedReason,
} from "@/lib/logistics-route-completion";
import type { AppSession } from "@/lib/auth/types";

type Supabase = NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>;

export type LogisticsTaskAddressRow = {
  taskId: string;
  address: LogisticsRouteStopAddress;
  zoneKey: string;
  zoneLabel: string;
  hasGeo: boolean;
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
  notes: string | null;
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
  created_at: string;
};

type LogisticsTaskDbRow = {
  id: string;
  status: LogisticsTaskStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  scheduled_at: string | null;
  shipment_id: string;
};

const ROUTE_SELECT = `
  id, route_date, name, status, assigned_to, vehicle_id, warehouse_id, zone_key, notes, created_at, updated_at,
  logistics_route_stops (
    id, route_id, task_id, stop_order, address_snapshot, lat, lng, postal_code, city, created_at
  )
`;

function canManageRoutes(session: AppSession) {
  return (
    sessionHasPermission(session, "routes.update_status") ||
    sessionHasPermission(session, "sales.manage")
  );
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
    createdAt: row.created_at,
  };
}

function mapRoute(row: LogisticsRouteDbRow): LogisticsRouteRow {
  const stops = (row.logistics_route_stops || [])
    .map(mapStop)
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
      "id, first_name, last_name, phones, street, house_number, neighborhood, city, state, postal_code, country, place_id, formatted_address, lat, lng",
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
    .eq("organization_id", session.organizationId);

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
    .select("id, status, assigned_to, assigned_at, scheduled_at, shipment_id")
    .eq("organization_id", session.organizationId)
    .in("id", taskIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as LogisticsTaskDbRow[];
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

export async function listLogisticsRoutesAction(): Promise<ActionResult<LogisticsRouteRow[]>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "routes.view")) {
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

export async function suggestLogisticsRoutesAction(input: {
  routeDate: string;
  vehicleCargoCapacity?: string | null;
}): Promise<ActionResult<LogisticsRouteSuggestion[]>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const fallbackDate = input.routeDate || new Date().toISOString().slice(0, 10);
    const tasks = await loadTaskInputs(supabase, session, {
      excludeRouted: true,
      onlyCurrentStep: true,
    });

    let vehicleCargoCapacity = input.vehicleCargoCapacity ?? null;

    if (!vehicleCargoCapacity) {
      const vehiclesResult = await listLogisticsVehiclesAction();

      if (vehiclesResult.ok) {
        vehicleCargoCapacity = pickFleetCargoCapacityLimit(vehiclesResult.data);
      }
    }

    return ok(
      suggestLogisticsRoutes(tasks, {
        fallbackDate,
        minimumStops: 1,
        vehicleCargoCapacity,
      }),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createLogisticsRouteFromSuggestionAction(input: {
  routeDate: string;
  name: string;
  zoneKey: string;
  warehouseId?: string | null;
  assignedTo?: string | null;
  taskIds: string[];
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

    const candidates = await loadTaskInputs(supabase, session, {
      excludeRouted: true,
      onlyCurrentStep: true,
    });
    const taskIdSet = new Set(input.taskIds);
    const selected = orderStopsByProximity(candidates.filter((task) => taskIdSet.has(task.taskId)));

    if (selected.length !== taskIdSet.size) {
      return fail("Alguna tarea ya no esta disponible para ruta");
    }

    if (!selected.every((task) => hasRouteGeo(task.address))) {
      return fail("No puedes crear ruta con tareas sin geo");
    }

    const routeDate = input.routeDate || new Date().toISOString().slice(0, 10);
    const warehouseId = input.warehouseId || selected[0]?.warehouseId || null;
    const assignedTo = input.assignedTo || null;
    const { data, error } = await supabase
      .from("logistics_routes")
      .insert({
        organization_id: session.organizationId,
        route_date: routeDate,
        name: input.name.trim() || `Ruta ${routeDate}`,
        status: assignedTo ? "planned" : "draft",
        assigned_to: assignedTo,
        warehouse_id: warehouseId,
        zone_key: input.zoneKey || (selected[0] ? logisticsZoneKey(selected[0].address) : ""),
        created_by: session.userId,
      })
      .select(ROUTE_SELECT)
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear ruta");
    }

    let route = mapRoute(data as unknown as LogisticsRouteDbRow);
    await insertStops(supabase, session, route.id, selected);
    route = await loadRouteById(supabase, session, route.id);

    if (assignedTo) {
      await syncRouteDriver(supabase, session, route, assignedTo);
      route = await loadRouteById(supabase, session, route.id);
    }

    await recordActivityHistory(supabase, session, {
      action: "logistics.route_created",
      entityType: "logistics_route",
      entityId: route.id,
      title: `Ruta creada: ${route.name}`,
      description: `${route.routeDate} · ${route.stops.length} paradas`,
      metadata: { taskIds: route.stops.map((stop) => stop.taskId), assignedTo },
    });

    return ok(route);
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
    if (route.status === "cancelled" || route.status === "completed") {
      return fail("No puedes modificar una ruta cerrada");
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
    if (route.status === "cancelled" || route.status === "completed") {
      return fail("No puedes modificar una ruta cerrada");
    }

    const stop = route.stops.find((entry) => entry.id === input.stopId);
    if (!stop) {
      return fail("Parada no encontrada");
    }

    const [task] = await loadTaskRows(supabase, session, [stop.taskId]);

    const { error } = await supabase
      .from("logistics_route_stops")
      .delete()
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
    if (route.status === "cancelled" || route.status === "completed") {
      return fail("No puedes asignar una ruta cerrada");
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
        status: assignedTo ? "planned" : "draft",
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
    if (route.status === "cancelled" || route.status === "completed") {
      return fail("No puedes modificar una ruta cerrada");
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
  const { error } = await supabase
    .from("logistics_routes")
    .update({
      status: "completed",
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

export async function completeLogisticsRouteAction(
  routeId: string,
): Promise<ActionResult<LogisticsRouteRow>> {
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
    const taskStatuses = await loadRouteTaskStatuses(
      supabase,
      session,
      route.stops.map((stop) => stop.taskId),
    );
    const blockedReason = routeCompletionBlockedReason(route, taskStatuses);

    if (blockedReason) {
      return fail(blockedReason);
    }

    const completed = await tryAutoCompleteLogisticsRoute(supabase, session, routeId);

    if (!completed) {
      return fail("No se pudo completar la ruta");
    }

    return ok(await loadRouteById(supabase, session, routeId));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
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
      return fail("Solo puedes cancelar rutas draft o planned");
    }

    await syncRouteDriver(supabase, session, route, null);

    const { error: deleteStopsError } = await supabase
      .from("logistics_route_stops")
      .delete()
      .eq("route_id", route.id)
      .eq("organization_id", session.organizationId);

    if (deleteStopsError) {
      return fail(deleteStopsError.message);
    }

    const { error } = await supabase
      .from("logistics_routes")
      .update({
        status: "cancelled",
        assigned_to: null,
        updated_at: new Date().toISOString(),
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

export type LogisticsTaskGeoPatchInput = {
  taskId: string;
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export async function patchLogisticsTaskAddressGeoAction(
  input: LogisticsTaskGeoPatchInput,
): Promise<ActionResult<LogisticsTaskAddressRow>> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      return fail("Coordenadas invalidas");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const shipments = await loadShipments();
    const taskShipment = shipments
      .flatMap((shipment) =>
        (shipment.logisticsTasks || []).map((task) => ({ task, shipment })),
      )
      .find((entry) => entry.task.id === input.taskId);

    if (!taskShipment) {
      return fail("Tarea no encontrada");
    }

    const { task, shipment } = taskShipment;
    const nowIso = new Date().toISOString();
    const geoPatch = {
      place_id: input.placeId.trim(),
      formatted_address: input.formattedAddress.trim(),
      lat: input.lat,
      lng: input.lng,
      geo_updated_at: nowIso,
    };

    if (shipment.customerId) {
      const customerPatch: Record<string, unknown> = {
        ...geoPatch,
        updated_at: nowIso,
      };

      if (input.street) customerPatch.street = input.street;
      if (input.houseNumber) customerPatch.house_number = input.houseNumber;
      if (input.neighborhood) customerPatch.neighborhood = input.neighborhood;
      if (input.city) customerPatch.city = input.city;
      if (input.state) customerPatch.state = input.state;
      if (input.postalCode) customerPatch.postal_code = input.postalCode;
      if (input.country) customerPatch.country = input.country;

      const { error: customerError } = await supabase
        .from("customers")
        .update(customerPatch)
        .eq("id", shipment.customerId)
        .eq("organization_id", session.organizationId);

      if (customerError) {
        return fail(customerError.message);
      }
    }

    const recipientSnapshot = {
      ...(shipment.recipientSnapshot && typeof shipment.recipientSnapshot === "object"
        ? shipment.recipientSnapshot
        : {}),
      street: input.street || "",
      houseNumber: input.houseNumber || "",
      neighborhood: input.neighborhood || "",
      city: input.city || "",
      state: input.state || "",
      postalCode: input.postalCode || "",
      country: input.country || "",
      formattedAddress: input.formattedAddress,
      placeId: input.placeId,
      lat: input.lat,
      lng: input.lng,
    };

    await supabase
      .from("shipments")
      .update({
        recipient_snapshot: recipientSnapshot,
        updated_at: nowIso,
      })
      .eq("id", shipment.id)
      .eq("organization_id", session.organizationId);

    const { data: stopRows } = await supabase
      .from("logistics_route_stops")
      .select("id, route_id")
      .eq("task_id", task.id)
      .eq("organization_id", session.organizationId);

    const addressSnapshot = {
      source: shipment.customerId ? "customer" : "recipient_snapshot",
      name: shipment.customer_name,
      phone: shipment.customerPhone || "",
      street: input.street || "",
      houseNumber: input.houseNumber || "",
      neighborhood: input.neighborhood || "",
      city: input.city || "",
      state: input.state || "",
      postalCode: input.postalCode || "",
      country: input.country || "",
      formattedAddress: input.formattedAddress,
      placeId: input.placeId,
      lat: input.lat,
      lng: input.lng,
    };

    for (const stopRow of stopRows || []) {
      const route = await loadRouteById(supabase, session, String(stopRow.route_id));

      if (route.status === "cancelled" || route.status === "completed") {
        continue;
      }

      await supabase
        .from("logistics_route_stops")
        .update({
          lat: input.lat,
          lng: input.lng,
          postal_code: input.postalCode || "",
          city: input.city || "",
          address_snapshot: addressSnapshot,
          updated_at: nowIso,
        })
        .eq("id", stopRow.id)
        .eq("organization_id", session.organizationId);
    }

    await recordActivityHistory(supabase, session, {
      action: "shipment.logistics_address_geo_updated",
      entityType: "shipment",
      entityId: shipment.id,
      title: `Geo corregida: ${shipment.code}`,
      description: input.formattedAddress,
      metadata: {
        taskId: task.id,
        shipmentCode: shipment.code,
        lat: input.lat,
        lng: input.lng,
        placeId: input.placeId,
      },
    });

    const addresses = await listLogisticsTaskAddressesAction();
    if (!addresses.ok) {
      return fail(addresses.error);
    }

    const updated = addresses.data.find((row) => row.taskId === task.id);
    if (!updated) {
      return fail("No se pudo recargar direccion");
    }

    return ok(updated);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listLogisticsTaskEvidenceAction(): Promise<
  ActionResult<ReturnType<typeof mapLogisticsEvidenceFromHistory>>
> {
  try {
    const session = await requireAppSession();

    if (!canManageRoutes(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("activity_history")
      .select("id, title, created_at, metadata")
      .eq("organization_id", session.organizationId)
      .in("action", [
        "shipment.logistics_task_updated",
        "shipment.logistics_task_failed",
      ])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return fail(error.message);
    }

    return ok(
      mapLogisticsEvidenceFromHistory(
        (data || []) as Array<{
          id: string;
          title: string;
          created_at: string;
          metadata?: Record<string, unknown> | null;
        }>,
      ),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
