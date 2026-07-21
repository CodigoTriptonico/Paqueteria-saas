"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { createStorageSignedUrl } from "@/lib/supabase/storage-url";
import {
  buildWarehouseIntakeSummary,
  validateWarehouseIntakeDraft,
  warehouseIntakeConditions,
  type WarehouseIntakeAvailablePackage,
  type WarehouseIntakeBin,
  type WarehouseIntakeCondition,
  type WarehouseIntakeItem,
  type WarehouseIntakeSession,
  type WarehouseIntakeStatus,
  type WarehouseIntakeSummary,
  type WarehouseIntakeWarehouse,
  type WarehouseIntakeWorkspace,
} from "@/lib/warehouse-intake";

const EVIDENCE_BUCKET = "warehouse-intake-evidence";
const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
const EVIDENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function canOperateWarehouse(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return sessionHasPermission(session, "warehouses.manage") || sessionHasPermission(session, "sales.manage");
}

function row(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(row) : [];
}

function text(value: unknown) {
  return String(value || "").trim();
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function profileName(value: Record<string, unknown> | undefined) {
  return text(value?.full_name) || text(value?.email) || "Sin registro";
}

function recipientName(snapshot: unknown) {
  const data = row(snapshot);
  return [text(data.firstName), text(data.lastName)].filter(Boolean).join(" ");
}

function normalizeSummary(value: unknown, fallback: WarehouseIntakeSummary) {
  const summary = row(value);
  if (!Object.keys(summary).length) return fallback;
  return {
    expected: Math.max(0, Number(summary.expected) || 0),
    received: Math.max(0, Number(summary.received) || 0),
    missing: Math.max(0, Number(summary.missing) || 0),
    unexpected: Math.max(0, Number(summary.unexpected) || 0),
    damaged: Math.max(0, Number(summary.damaged) || 0),
    unidentified: Math.max(0, Number(summary.unidentified) || 0),
    weightDifferences: Math.max(0, Number(summary.weightDifferences) || 0),
    quarantine: Math.max(0, Number(summary.quarantine) || 0),
  };
}

function intakeErrorMessage(error: unknown) {
  const raw = actionErrorMessage(error);
  const mappings: Array<[string, string]> = [
    ["PACKAGE_CUSTODY_CONFLICT", "Esta caja ya tiene una custodia final. Revisa su historial antes de moverla."],
    ["INTAKE_KIND_MISMATCH", "Esta accion no corresponde al tipo de ingreso abierto."],
    ["WAREHOUSE_FORBIDDEN", "No tienes acceso a esa bodega."],
    ["WAREHOUSE_NOT_FOUND", "La bodega no está disponible."],
    ["ARRIVAL_WAREHOUSE_MISMATCH", "Esta ruta debe recibirse en la bodega que confirmó el conductor."],
    ["ROUTE_NOT_READY", "La ruta todavía no ha llegado a bodega."],
    ["ROUTE_WITHOUT_PACKAGES", "Ese camión no tiene cajas listas para ingresar."],
    ["PACKAGE_ALREADY_SCANNED", "Esta caja ya fue escaneada en este ingreso."],
    ["PACKAGE_ALREADY_RECEIVED", "Esta caja ya fue ingresada o ya no está bajo custodia del conductor."],
    ["PACKAGE_NOT_FOUND", "No encontramos una caja con ese código."],
    ["PACKAGE_CODE_REQUIRED", "Escanea o escribe el código de la caja."],
    ["WEIGHT_INVALID", "Indica un peso recibido válido en kg."],
    ["WEIGHT_NOTE_REQUIRED", "La diferencia de peso supera la tolerancia. Escribe una observación."],
    ["EXCEPTION_EVIDENCE_REQUIRED", "Para registrar un problema necesitas una observación y una foto."],
    ["BIN_NOT_FOUND", "La ubicación seleccionada no pertenece a esta bodega."],
    ["INTAKE_CLOSED", "Este ingreso ya está cerrado. Reábrelo con autorización para agregar cajas."],
    ["INTAKE_NOT_FOUND", "No encontramos el ingreso de bodega."],
    ["RECEIVER_CONFIRMATION_REQUIRED", "El encargado de bodega debe confirmar el cierre."],
    ["DRIVER_CONFIRMATION_OR_NOTE_REQUIRED", "Confirma al conductor o explica por qué no pudo confirmar."],
    ["REOPEN_REASON_REQUIRED", "Escribe el motivo de reapertura."],
  ];
  return mappings.find(([code]) => raw.includes(code))?.[1] || raw;
}

async function uploadEvidence(input: {
  organizationId: string;
  sessionId: string;
  operationKey: string;
  file: File | null;
}) {
  if (!input.file || !input.file.name || input.file.size <= 0) return "";
  if (input.file.size > EVIDENCE_MAX_BYTES) throw new Error("La foto no puede superar 8 MB.");
  if (!EVIDENCE_TYPES.has(input.file.type)) throw new Error("La foto debe ser JPG, PNG o WebP.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase service role no configurado");
  const extension = input.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const safeOperation = input.operationKey.replace(/[^a-zA-Z0-9-]/g, "");
  const path = `${input.organizationId}/${input.sessionId}/${safeOperation}.${extension}`;
  const { error } = await admin.storage.from(EVIDENCE_BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
  return path;
}

async function removeEvidence(path: string) {
  if (!path) return;
  const admin = createSupabaseAdminClient();
  if (admin) await admin.storage.from(EVIDENCE_BUCKET).remove([path]);
}

async function loadWorkspace(): Promise<WarehouseIntakeWorkspace> {
  const session = await requireAppSession();
  if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
  const supabase = await createScopedSupabase(session);
  if (!supabase) throw new Error("Supabase no configurado");

  let warehouseQuery = supabase
    .from("warehouses")
    .select("id, name, is_default")
    .eq("organization_id", session.organizationId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name");
  if (!sessionHasPermission(session, "all")) {
    if (!session.warehouseIds.length) {
      return { sessions: [], warehouses: [], bins: [], availablePackages: [], toleranceKg: 0, canReopen: false };
    }
    warehouseQuery = warehouseQuery.in("id", session.warehouseIds);
  }
  const { data: warehouseData, error: warehouseError } = await warehouseQuery;
  if (warehouseError) throw new Error(warehouseError.message);
  const warehouses: WarehouseIntakeWarehouse[] = rows(warehouseData).map((warehouse) => ({
    id: text(warehouse.id),
    name: text(warehouse.name),
    isDefault: Boolean(warehouse.is_default),
  }));
  const warehouseIds = warehouses.map((warehouse) => warehouse.id);
  if (!warehouseIds.length) {
    return { sessions: [], warehouses, bins: [], availablePackages: [], toleranceKg: 0, canReopen: false };
  }

  const [sessionsResult, binsResult, packagesResult, settingsResult] = await Promise.all([
    supabase.from("warehouse_intake_sessions")
      .select("id, code, status, intake_kind, route_id, warehouse_id, expected_count, started_at, closed_at, closed_by, driver_confirmed, driver_exception_note, close_summary")
      .eq("organization_id", session.organizationId)
      .in("warehouse_id", warehouseIds)
      .order("started_at", { ascending: false })
      .limit(24),
    supabase.from("warehouse_bins")
      .select("id, warehouse_id, code, label")
      .eq("organization_id", session.organizationId)
      .in("warehouse_id", warehouseIds)
      .eq("is_active", true)
      .order("sort_order")
      .order("code"),
    supabase.from("shipment_packages")
      .select("id, shipment_id, code, invoice_code, country, collection_weight_kg, invoice_payment_status, truck_route_id")
      .eq("organization_id", session.organizationId)
      .in("status", ["in_truck", "pending_intake"]),
    supabase.from("organizations").select("settings").eq("id", session.organizationId).single(),
  ]);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  if (binsResult.error) throw new Error(binsResult.error.message);
  if (packagesResult.error) throw new Error(packagesResult.error.message);

  const sessionRows = rows(sessionsResult.data);
  const intakeIds = sessionRows.map((intake) => text(intake.id));
  const routeIds = [...new Set(sessionRows.map((intake) => text(intake.route_id)).filter(Boolean))];
  const closedByIds = sessionRows.map((intake) => text(intake.closed_by)).filter(Boolean);
  const itemResult = intakeIds.length
    ? await supabase.from("warehouse_intake_items")
        .select("id, session_id, package_id, scanned_code, match_status, physical_condition, received_weight_kg, weight_difference_kg, weight_out_of_tolerance, location_label, note, evidence_path, scanned_by, scanned_at")
        .in("session_id", intakeIds)
        .order("scanned_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };
  if (itemResult.error) throw new Error(itemResult.error.message);
  const itemRows = rows(itemResult.data);
  const itemPackageIds = itemRows.map((item) => text(item.package_id)).filter(Boolean);
  const shipmentPackageRows = rows(packagesResult.data);
  const missingPackageIds = itemPackageIds.filter((id) => !shipmentPackageRows.some((pkg) => text(pkg.id) === id));
  if (missingPackageIds.length) {
    const historicalResult = await supabase.from("shipment_packages")
      .select("id, shipment_id, code, invoice_code, country, collection_weight_kg, invoice_payment_status, truck_route_id")
      .in("id", missingPackageIds);
    if (historicalResult.error) throw new Error(historicalResult.error.message);
    shipmentPackageRows.push(...rows(historicalResult.data));
  }

  const shipmentIds = [...new Set(shipmentPackageRows.map((pkg) => text(pkg.shipment_id)).filter(Boolean))];
  const actorIds = [...new Set([...closedByIds, ...itemRows.map((item) => text(item.scanned_by)).filter(Boolean)])];
  const [routesResult, shipmentsResult, profilesResult] = await Promise.all([
    routeIds.length
      ? supabase.from("logistics_routes").select("id, name, vehicle_id, assigned_to").in("id", routeIds)
      : Promise.resolve({ data: [], error: null }),
    shipmentIds.length
      ? supabase.from("shipments").select("id, code, customer_name, recipient_snapshot").in("id", shipmentIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (routesResult.error) throw new Error(routesResult.error.message);
  if (shipmentsResult.error) throw new Error(shipmentsResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  const routeRows = rows(routesResult.data);
  const driverIds = routeRows.map((route) => text(route.assigned_to)).filter(Boolean);
  const vehicleIds = routeRows.map((route) => text(route.vehicle_id)).filter(Boolean);
  const [driversResult, vehiclesResult] = await Promise.all([
    driverIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", driverIds) : Promise.resolve({ data: [], error: null }),
    vehicleIds.length ? supabase.from("logistics_vehicles").select("id, name").in("id", vehicleIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (driversResult.error) throw new Error(driversResult.error.message);
  if (vehiclesResult.error) throw new Error(vehiclesResult.error.message);

  const profiles = new Map([...rows(profilesResult.data), ...rows(driversResult.data)].map((profile) => [text(profile.id), profile]));
  const routes = new Map(routeRows.map((route) => [text(route.id), route]));
  const vehicles = new Map(rows(vehiclesResult.data).map((vehicle) => [text(vehicle.id), vehicle]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const shipments = new Map(rows(shipmentsResult.data).map((shipment) => [text(shipment.id), shipment]));
  const packageMap = new Map(shipmentPackageRows.map((pkg) => [text(pkg.id), pkg]));
  const admin = createSupabaseAdminClient();

  const mappedItems = await Promise.all(itemRows.map(async (item): Promise<WarehouseIntakeItem> => {
    const packageRow = packageMap.get(text(item.package_id));
    const shipmentRow = packageRow ? shipments.get(text(packageRow.shipment_id)) : undefined;
    const evidencePath = text(item.evidence_path);
    return {
      id: text(item.id),
      packageId: text(item.package_id) || null,
      scannedCode: text(item.scanned_code),
      matchStatus: (text(item.match_status) || "unidentified") as WarehouseIntakeItem["matchStatus"],
      condition: text(item.physical_condition) as WarehouseIntakeCondition,
      receivedWeightKg: nullableNumber(item.received_weight_kg),
      weightDifferenceKg: nullableNumber(item.weight_difference_kg),
      weightOutOfTolerance: Boolean(item.weight_out_of_tolerance),
      locationLabel: text(item.location_label),
      note: text(item.note),
      evidencePath,
      evidenceUrl: admin && evidencePath ? await createStorageSignedUrl(admin, EVIDENCE_BUCKET, evidencePath) : evidencePath,
      scannedAt: text(item.scanned_at),
      scannedByName: profileName(profiles.get(text(item.scanned_by))),
      package: packageRow ? {
        invoiceCode: text(packageRow.invoice_code),
        shipmentCode: text(shipmentRow?.code),
        customerName: text(shipmentRow?.customer_name),
        recipientName: recipientName(shipmentRow?.recipient_snapshot),
        country: text(packageRow.country),
        paymentStatus: packageRow.invoice_payment_status === "paid" ? "paid" : "pending",
        collectionWeightKg: nullableNumber(packageRow.collection_weight_kg),
      } : null,
    };
  }));

  const sessions: WarehouseIntakeSession[] = sessionRows.map((intake) => {
    const intakeItems = mappedItems.filter((item) => text(itemRows.find((candidate) => text(candidate.id) === item.id)?.session_id) === text(intake.id));
    const route = routes.get(text(intake.route_id));
    const fallbackSummary = buildWarehouseIntakeSummary({
      expected: Number(intake.expected_count) || 0,
      items: intakeItems.map((item) => ({
        matchStatus: item.matchStatus,
        condition: item.condition,
        weightOutOfTolerance: item.weightOutOfTolerance,
        locationLabel: item.locationLabel,
      })),
    });
    return {
      id: text(intake.id),
      code: text(intake.code),
      status: text(intake.status) as WarehouseIntakeStatus,
      intakeKind: text(intake.intake_kind) === "found_in_warehouse" ? "found_in_warehouse" : "truck_manifest",
      routeId: text(intake.route_id) || null,
      routeName: text(route?.name) || (text(intake.intake_kind) === "found_in_warehouse" ? "Caja encontrada" : "Ruta"),
      vehicleName: text(vehicles.get(text(route?.vehicle_id))?.name) || "Camión",
      driverName: text(intake.intake_kind) === "found_in_warehouse" ? "Origen desconocido" : profileName(profiles.get(text(route?.assigned_to))),
      warehouseId: text(intake.warehouse_id),
      warehouseName: warehouseMap.get(text(intake.warehouse_id))?.name || "Bodega",
      expectedCount: Number(intake.expected_count) || 0,
      startedAt: text(intake.started_at),
      closedAt: text(intake.closed_at) || null,
      closedByName: text(intake.closed_by) ? profileName(profiles.get(text(intake.closed_by))) : "",
      driverConfirmed: Boolean(intake.driver_confirmed),
      driverExceptionNote: text(intake.driver_exception_note),
      summary: normalizeSummary(intake.close_summary, fallbackSummary),
      items: intakeItems,
    };
  });

  const availablePackages: WarehouseIntakeAvailablePackage[] = rows(packagesResult.data).map((pkg) => {
    const shipment = shipments.get(text(pkg.shipment_id));
    return {
      id: text(pkg.id),
      code: text(pkg.code),
      invoiceCode: text(pkg.invoice_code),
      shipmentCode: text(shipment?.code),
      customerName: text(shipment?.customer_name),
      recipientName: recipientName(shipment?.recipient_snapshot),
      country: text(pkg.country),
      paymentStatus: pkg.invoice_payment_status === "paid" ? "paid" : "pending",
      collectionWeightKg: nullableNumber(pkg.collection_weight_kg),
      truckRouteId: text(pkg.truck_route_id) || null,
    };
  });

  const bins: WarehouseIntakeBin[] = rows(binsResult.data).map((bin) => ({
    id: text(bin.id), warehouseId: text(bin.warehouse_id), code: text(bin.code), label: text(bin.label),
  }));
  const settings = row(settingsResult.data?.settings);
  return {
    sessions,
    warehouses,
    bins,
    availablePackages,
    toleranceKg: Math.max(0, Number(settings.warehouse_weight_tolerance_kg) || 0),
    canReopen: sessionHasPermission(session, "settings.manage"),
  };
}

export async function getWarehouseIntakeWorkspaceAction(): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  try {
    return ok(await loadWorkspace());
  } catch (error) {
    return fail(intakeErrorMessage(error));
  }
}

export async function openWarehouseIntakeAction(input: {
  routeId: string;
  warehouseId: string;
  operationKey?: string;
}): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { error } = await supabase.rpc("open_warehouse_intake", {
      target_route_id: input.routeId,
      target_warehouse_id: input.warehouseId,
      operation_key: input.operationKey || randomUUID(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    return ok(await loadWorkspace());
  } catch (error) {
    return fail(intakeErrorMessage(error));
  }
}

export async function openFoundWarehouseIntakeAction(input: {
  warehouseId: string;
  operationKey?: string;
}): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { error } = await supabase.rpc("open_found_warehouse_intake", {
      target_warehouse_id: input.warehouseId,
      operation_key: input.operationKey || randomUUID(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    return ok(await loadWorkspace());
  } catch (error) {
    return fail(intakeErrorMessage(error));
  }
}

export async function scanWarehouseIntakePackageAction(formData: FormData): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  let evidencePath = "";
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const sessionId = text(formData.get("sessionId"));
    const code = text(formData.get("code"));
    const conditionValue = text(formData.get("condition"));
    const condition = warehouseIntakeConditions.includes(conditionValue as WarehouseIntakeCondition)
      ? conditionValue as WarehouseIntakeCondition
      : "correct";
    const weightKg = nullableNumber(text(formData.get("weightKg")).replace(",", "."));
    const note = text(formData.get("note"));
    const binId = text(formData.get("binId"));
    const operationKey = text(formData.get("operationKey")) || randomUUID();
    const fileValue = formData.get("evidence");
    const evidence = fileValue instanceof File && fileValue.name ? fileValue : null;
    const { data: knownPackage } = await supabase.from("shipment_packages")
      .select("id")
      .eq("organization_id", session.organizationId)
      .ilike("code", code)
      .maybeSingle();
    const validation = validateWarehouseIntakeDraft({
      code, condition, weightKg, note, hasEvidence: Boolean(evidence), isKnownPackage: Boolean(knownPackage),
    });
    if (!validation.ok) return fail(validation.error);
    evidencePath = await uploadEvidence({ organizationId: session.organizationId, sessionId, operationKey, file: evidence });
    const { error } = await supabase.rpc("scan_warehouse_intake_package", {
      target_session_id: sessionId,
      scanned_code_value: code,
      received_weight_value: weightKg,
      condition_value: condition,
      note_value: note,
      evidence_path_value: evidencePath,
      target_bin_id: binId || null,
      operation_key: operationKey,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    revalidatePath("/seguimiento/excepciones");
    return ok(await loadWorkspace());
  } catch (error) {
    await removeEvidence(evidencePath);
    return fail(intakeErrorMessage(error));
  }
}

export async function scanFoundWarehouseIntakePackageAction(formData: FormData): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  let evidencePath = "";
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const sessionId = text(formData.get("sessionId"));
    const code = text(formData.get("code"));
    const weightKg = nullableNumber(text(formData.get("weightKg")).replace(",", "."));
    const note = text(formData.get("note"));
    const operationKey = text(formData.get("operationKey")) || randomUUID();
    const fileValue = formData.get("evidence");
    const evidence = fileValue instanceof File && fileValue.name ? fileValue : null;
    if (!code) return fail("Escanea o escribe el codigo de la caja.");
    if (!note) return fail("Describe donde encontraste la caja o por que no se conoce su origen.");
    if (!evidence) return fail("Toma una foto de la caja antes de ingresarla.");
    const { data: knownPackage } = await supabase.from("shipment_packages")
      .select("id")
      .eq("organization_id", session.organizationId)
      .ilike("code", code)
      .maybeSingle();
    if (knownPackage && (!weightKg || weightKg <= 0)) return fail("Indica el peso recibido en kg.");
    evidencePath = await uploadEvidence({ organizationId: session.organizationId, sessionId, operationKey, file: evidence });
    const { error } = await supabase.rpc("scan_found_warehouse_intake_package", {
      target_session_id: sessionId,
      scanned_code_value: code,
      received_weight_value: weightKg,
      note_value: note,
      evidence_path_value: evidencePath,
      operation_key: operationKey,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    revalidatePath("/seguimiento/excepciones");
    return ok(await loadWorkspace());
  } catch (error) {
    await removeEvidence(evidencePath);
    return fail(intakeErrorMessage(error));
  }
}

export async function closeWarehouseIntakeAction(input: {
  sessionId: string;
  driverConfirmed: boolean;
  driverExceptionNote: string;
  receiverConfirmed: boolean;
  operationKey?: string;
}): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { error } = await supabase.rpc("close_warehouse_intake", {
      target_session_id: input.sessionId,
      driver_confirmed_value: input.driverConfirmed,
      driver_exception_note_value: input.driverExceptionNote,
      receiver_confirmed_value: input.receiverConfirmed,
      operation_key: input.operationKey || randomUUID(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ingreso-bodega");
    revalidatePath("/seguimiento/excepciones");
    return ok(await loadWorkspace());
  } catch (error) {
    return fail(intakeErrorMessage(error));
  }
}

export async function reopenWarehouseIntakeAction(input: {
  sessionId: string;
  reason: string;
  operationKey?: string;
}): Promise<ActionResult<WarehouseIntakeWorkspace>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "settings.manage")) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { error } = await supabase.rpc("reopen_warehouse_intake", {
      target_session_id: input.sessionId,
      reason_value: input.reason,
      operation_key: input.operationKey || randomUUID(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ingreso-bodega");
    return ok(await loadWorkspace());
  } catch (error) {
    return fail(intakeErrorMessage(error));
  }
}
