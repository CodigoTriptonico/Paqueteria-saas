"use server";

import { revalidatePath } from "next/cache";
import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  parsePackageContents,
  type PackageInvoiceLifecycleEvent,
  type PackageInvoiceLifecycleState,
  type PhysicalPackage,
  type PhysicalPackageStatus,
  validatePackageContents,
} from "@/lib/physical-packages";

type PackageDbRow = Record<string, unknown> & {
  id: string;
  shipment_id: string;
  code: string;
  country: string;
  status: PhysicalPackageStatus;
  collection_weight_kg: number | string | null;
  collection_source: "driver" | "office" | null;
  collection_recorded_at: string | null;
  intake_weight_kg: number | string | null;
  intake_recorded_at: string | null;
  weight_difference_kg: number | string | null;
  weight_difference_note: string | null;
  weight_difference_reviewed_at: string | null;
  contents: unknown;
  contents_validated_at: string | null;
  provider_name: string | null;
  provider_service: string | null;
  provider_confirmation_number: string | null;
  provider_tracking_number: string | null;
  provider_tracking_url: string | null;
  pallet_id: string | null;
  truck_route_id: string | null;
  truck_task_id: string | null;
  truck_arrived_at: string | null;
  truck_unloaded_at: string | null;
  warehouse_placed_at: string | null;
  palletized_at: string | null;
  invoice_code: string | null;
  invoice_marked_at: string | null;
  invoice_delivery_evidence_url: string | null;
  invoice_pickup_confirmed_at: string | null;
  invoice_pickup_evidence_url: string | null;
  invoice_incident_at: string | null;
  invoice_incident_reason: string | null;
  invoice_payment_status: "pending" | "paid" | null;
  invoice_fulfillment_status: "created" | "in_warehouse" | "in_transit" | "delivered" | null;
  shipment_package_invoice_events?: Array<{
    state: PackageInvoiceLifecycleState;
    occurred_at: string;
    changed_by_profile?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
  }> | null;
  shipments?: {
    code?: string;
    customer_name?: string;
    recipient_snapshot?: Record<string, unknown> | null;
  } | null;
  warehouse_pallets?: { code?: string } | null;
};

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recipientName(snapshot: Record<string, unknown> | null | undefined) {
  return [snapshot?.firstName, snapshot?.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function lifecycleEvents(row: PackageDbRow): PackageInvoiceLifecycleEvent[] {
  return (row.shipment_package_invoice_events || [])
    .map((event) => {
      const profile = Array.isArray(event.changed_by_profile)
        ? event.changed_by_profile[0]
        : event.changed_by_profile;
      return {
        state: event.state,
        occurredAt: event.occurred_at,
        changedByName: String(profile?.full_name || profile?.email || "Sin registro"),
      };
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function mapPackage(row: unknown): PhysicalPackage {
  const packageRow = row as PackageDbRow;
  return {
    id: packageRow.id,
    shipmentId: packageRow.shipment_id,
    shipmentCode: String(packageRow.shipments?.code || ""),
    customerName: String(packageRow.shipments?.customer_name || ""),
    recipientName: recipientName(packageRow.shipments?.recipient_snapshot),
    code: packageRow.code,
    country: packageRow.country,
    status: packageRow.status,
    collectionWeightKg: numberOrNull(packageRow.collection_weight_kg),
    collectionSource: packageRow.collection_source || null,
    collectionRecordedAt: packageRow.collection_recorded_at,
    intakeWeightKg: numberOrNull(packageRow.intake_weight_kg),
    intakeRecordedAt: packageRow.intake_recorded_at,
    weightDifferenceKg: numberOrNull(packageRow.weight_difference_kg),
    weightDifferenceNote: packageRow.weight_difference_note || "",
    weightDifferenceReviewedAt: packageRow.weight_difference_reviewed_at,
    contents: parsePackageContents(packageRow.contents),
    contentsValidatedAt: packageRow.contents_validated_at,
    providerName: packageRow.provider_name || "",
    providerService: packageRow.provider_service || "",
    providerConfirmationNumber: packageRow.provider_confirmation_number || "",
    providerTrackingNumber: packageRow.provider_tracking_number || "",
    providerTrackingUrl: packageRow.provider_tracking_url || "",
    palletId: packageRow.pallet_id,
    palletCode: packageRow.warehouse_pallets?.code || null,
    truckRouteId: packageRow.truck_route_id,
    truckTaskId: packageRow.truck_task_id,
    truckArrivedAt: packageRow.truck_arrived_at,
    truckUnloadedAt: packageRow.truck_unloaded_at,
    warehousePlacedAt: packageRow.warehouse_placed_at,
    palletizedAt: packageRow.palletized_at,
    invoiceCode: packageRow.invoice_code || String(packageRow.shipments?.code || ""),
    invoiceMarkedAt: packageRow.invoice_marked_at,
    invoiceDeliveryEvidenceUrl: packageRow.invoice_delivery_evidence_url || "",
    invoicePickupConfirmedAt: packageRow.invoice_pickup_confirmed_at,
    invoicePickupEvidenceUrl: packageRow.invoice_pickup_evidence_url || "",
    invoiceIncidentAt: packageRow.invoice_incident_at,
    invoiceIncidentReason: packageRow.invoice_incident_reason || "",
    invoicePaymentStatus: packageRow.invoice_payment_status === "paid" ? "paid" : "pending",
    invoiceFulfillmentStatus: packageRow.invoice_fulfillment_status || "created",
    invoiceLifecycle: lifecycleEvents(packageRow),
  };
}

function canOperateWarehouse(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "warehouses.manage") ||
    sessionHasPermission(session, "sales.manage")
  );
}

const PACKAGE_SELECT = `
  id, shipment_id, code, country, status, collection_weight_kg, collection_source,
  collection_recorded_at, intake_weight_kg, intake_recorded_at, weight_difference_kg,
  weight_difference_note, weight_difference_reviewed_at, contents, contents_validated_at, provider_name, provider_service,
  provider_confirmation_number, provider_tracking_number, provider_tracking_url, pallet_id,
  truck_route_id, truck_task_id, truck_arrived_at, truck_unloaded_at, warehouse_placed_at, palletized_at,
  invoice_code, invoice_marked_at, invoice_delivery_evidence_url, invoice_pickup_confirmed_at, invoice_pickup_evidence_url,
  invoice_incident_at, invoice_incident_reason, invoice_payment_status, invoice_fulfillment_status,
  shipment_package_invoice_events(
    state, occurred_at,
    changed_by_profile:profiles!shipment_package_invoice_events_changed_by_fkey(full_name, email)
  ),
  shipments(code, customer_name, recipient_snapshot), warehouse_pallets(code)
`;

export async function listWarehousePackagesAction(
  statuses: PhysicalPackageStatus[],
): Promise<ActionResult<PhysicalPackage[]>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase
      .from("shipment_packages")
      .select(PACKAGE_SELECT)
      .eq("organization_id", session.organizationId)
      .in("status", statuses)
      .order("created_at");
    if (error) return fail(error.message);
    return ok((data || []).map(mapPackage));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function movePhysicalPackageToWarehouseAction(
  packageId: string,
): Promise<ActionResult<PhysicalPackage>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("shipment_packages")
      .update({
        status: "in_warehouse",
        warehouse_placed_at: now,
        warehouse_placed_by: session.userId,
        updated_at: now,
      })
      .eq("id", packageId)
      .eq("organization_id", session.organizationId)
      .eq("status", "warehouse_intake")
      .select(PACKAGE_SELECT)
      .maybeSingle();
    if (error || !data) {
      return fail("La caja debe estar confirmada en Ingreso a bodega antes de moverla.");
    }
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    return ok(mapPackage(data as PackageDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export type WarehouseTruckArrival = {
  routeId: string;
  routeName: string;
  vehicleName: string;
  driverName: string;
  arrivedAt: string | null;
  arrivalWarehouseId: string;
  arrivalWarehouseName: string;
  arrivalReason: string;
  packageCount: number;
};

const warehouseArrivalReasonLabel: Record<string, string> = {
  completed_normally: "Terminó todas las visitas",
  unfinished_stops: "Regresó con entregas pendientes",
  vehicle_problem: "Problema con el camión",
  other: "Otra razón",
};

export async function listWarehouseTruckArrivalsAction(): Promise<ActionResult<WarehouseTruckArrival[]>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const [{ data, error }, { data: openIntakes, error: intakeError }] = await Promise.all([
      supabase
        .from("shipment_packages")
        .select(
          "truck_route_id, truck_arrived_at, logistics_routes(id, name, assigned_to, arrival_warehouse_id, arrival_reason_code, arrival_note, logistics_vehicles(name), profiles:assigned_to(full_name))",
        )
        .eq("organization_id", session.organizationId)
        .eq("status", "in_truck")
        .not("truck_arrived_at", "is", null)
        .not("truck_route_id", "is", null),
      supabase
        .from("warehouse_intake_sessions")
        .select("route_id")
        .eq("organization_id", session.organizationId)
        .in("status", ["unloading", "in_review"]),
    ]);
    if (error) return fail(error.message);
    if (intakeError) return fail(intakeError.message);
    const arrivalWarehouseIds = [...new Set((data || []).map((row) => {
      const route = row.logistics_routes as unknown as Record<string, unknown> | null;
      return String(route?.arrival_warehouse_id || "");
    }).filter(Boolean))];
    const warehouseResult = arrivalWarehouseIds.length
      ? await supabase.from("warehouses").select("id, name").in("id", arrivalWarehouseIds)
      : { data: [], error: null };
    if (warehouseResult.error) return fail(warehouseResult.error.message);
    const warehouseNames = new Map((warehouseResult.data || []).map((warehouse) => [String(warehouse.id), String(warehouse.name || "Bodega")]));
    const routesInIntake = new Set((openIntakes || []).map((row) => String(row.route_id)));
    const arrivals = new Map<string, WarehouseTruckArrival>();
    for (const row of data || []) {
      const route = row.logistics_routes as unknown as Record<string, unknown> | null;
      const routeId = String(row.truck_route_id || "");
      if (!routeId || routesInIntake.has(routeId)) continue;
      const current = arrivals.get(routeId);
      if (current) {
        current.packageCount += 1;
        continue;
      }
      const vehicle = route?.logistics_vehicles as Record<string, unknown> | null;
      const driver = route?.profiles as Record<string, unknown> | null;
      const arrivalWarehouseId = String(route?.arrival_warehouse_id || "");
      const arrivalReasonCode = String(route?.arrival_reason_code || "");
      arrivals.set(routeId, {
        routeId,
        routeName: String(route?.name || "Ruta finalizada"),
        vehicleName: String(vehicle?.name || "Camión"),
        driverName: String(driver?.full_name || "Sin conductor"),
        arrivedAt: (row.truck_arrived_at as string | null) || null,
        arrivalWarehouseId,
        arrivalWarehouseName: warehouseNames.get(arrivalWarehouseId) || "Bodega sin identificar",
        arrivalReason: String(route?.arrival_note || warehouseArrivalReasonLabel[arrivalReasonCode] || ""),
        packageCount: 1,
      });
    }
    return ok(
      [...arrivals.values()].sort((left, right) =>
        String(right.arrivedAt || "").localeCompare(String(left.arrivedAt || "")),
      ),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function reviewPhysicalPackageWeightDifferenceAction(
  packageId: string,
): Promise<ActionResult<PhysicalPackage>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, "settings.manage")) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("shipment_packages")
      .update({
        weight_difference_reviewed_at: now,
        weight_difference_reviewed_by: session.userId,
        updated_at: now,
      })
      .eq("id", packageId)
      .eq("organization_id", session.organizationId)
      .not("weight_difference_kg", "is", null)
      .select(PACKAGE_SELECT)
      .maybeSingle();
    if (error || !data) return fail(error?.message || "No encontramos la caja en recepción.");
    return ok(mapPackage(data as PackageDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updatePhysicalPackageReviewAction(input: {
  packageId: string;
  contents: unknown;
  providerName: string;
  providerService: string;
  confirmationNumber: string;
  trackingNumber: string;
  trackingUrl?: string;
}): Promise<ActionResult<PhysicalPackage>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const validated = validatePackageContents(input.contents);
    if (!validated.ok) return fail(validated.error);
    const providerName = input.providerName.trim();
    const confirmation = input.confirmationNumber.trim();
    const tracking = input.trackingNumber.trim();
    if (!providerName || !confirmation || !tracking) {
      return fail("Selecciona proveedor e indica confirmación y rastreo.");
    }
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase
      .from("shipment_packages")
      .update({
        contents: validated.data,
        contents_validated_at: new Date().toISOString(),
        contents_validated_by: session.userId,
        provider_name: providerName,
        provider_service: input.providerService.trim(),
        provider_confirmation_number: confirmation,
        provider_tracking_number: tracking,
        provider_tracking_url: input.trackingUrl?.trim() || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.packageId)
      .eq("organization_id", session.organizationId)
      .in("status", ["in_warehouse", "on_pallet"])
      .select(PACKAGE_SELECT)
      .maybeSingle();
    if (error || !data) return fail("La caja debe estar en bodega para revisarla.");
    revalidatePath("/bodega");
    revalidatePath("/paletas");
    revalidatePath("/seguimiento");
    return ok(mapPackage(data as PackageDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

type WarehousePalletPackage = {
  id: string;
  code: string;
  intakeRecordedAt: string | null;
  palletizedAt: string | null;
};

export type WarehousePallet = {
  id: string;
  code: string;
  country: string;
  status: "open" | "closed";
  packageCount: number;
  packages: WarehousePalletPackage[];
};

export async function listWarehousePalletsAction(): Promise<ActionResult<WarehousePallet[]>> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase
      .from("warehouse_pallets")
      .select(
        "id, code, country, status, shipment_packages(id, code, intake_recorded_at, palletized_at)",
      )
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok(
      (data || []).map((row: Record<string, unknown>) => {
        const packageRows = Array.isArray(row.shipment_packages) ? row.shipment_packages : [];
        const packages = packageRows.map((packageRow) => {
          const value = packageRow as Record<string, unknown>;
          return {
            id: String(value.id),
            code: String(value.code),
            intakeRecordedAt:
              typeof value.intake_recorded_at === "string" ? value.intake_recorded_at : null,
            palletizedAt:
              typeof value.palletized_at === "string" ? value.palletized_at : null,
          };
        });
        return {
          id: String(row.id),
          code: String(row.code),
          country: String(row.country),
          status: row.status === "closed" ? ("closed" as const) : ("open" as const),
          packageCount: packages.length,
          packages,
        };
      }),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createWarehousePalletAction(input: {
  code: string;
  country: string;
}): Promise<ActionResult<WarehousePallet>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase
      .from("warehouse_pallets")
      .insert({
        organization_id: session.organizationId,
        code: input.code.trim(),
        country: input.country.trim(),
        created_by: session.userId,
      })
      .select("id, code, country, status")
      .single();
    if (error || !data) return fail(error?.message || "No se pudo crear la paleta");
    revalidatePath("/paletas");
    return ok({ ...data, packageCount: 0, packages: [] });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function addPhysicalPackageToPalletAction(input: {
  packageId: string;
  palletId: string;
}) {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const [{ data: pkg }, { data: pallet }] = await Promise.all([
      supabase
        .from("shipment_packages")
        .select("id, country, status")
        .eq("id", input.packageId)
        .eq("organization_id", session.organizationId)
        .maybeSingle(),
      supabase
        .from("warehouse_pallets")
        .select("id, country, status, code")
        .eq("id", input.palletId)
        .eq("organization_id", session.organizationId)
        .maybeSingle(),
    ]);
    if (!pkg || !pallet) return fail("Caja o paleta no encontrada.");
    if (pkg.status !== "in_warehouse") {
      return fail("La caja debe estar en bodega y con peso de ingreso.");
    }
    if (pallet.status !== "open") return fail("La paleta está cerrada.");
    if (pkg.country.trim().toLowerCase() !== pallet.country.trim().toLowerCase()) {
      return fail("No puedes mezclar países dentro de una paleta.");
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("shipment_packages")
      .update({
        pallet_id: pallet.id,
        status: "on_pallet",
        palletized_at: now,
        palletized_by: session.userId,
        updated_at: now,
      })
      .eq("id", pkg.id)
      .eq("organization_id", session.organizationId);
    if (error) return fail(error.message);
    revalidatePath("/bodega");
    revalidatePath("/paletas");
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
