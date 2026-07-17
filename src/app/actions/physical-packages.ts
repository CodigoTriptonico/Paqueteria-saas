"use server";

import { revalidatePath } from "next/cache";
import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import {
  parsePackageContents,
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
  invoice_incident_at, invoice_incident_reason,
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

export async function receivePhysicalPackageAtIntakeAction(input: {
  code: string;
  weightKg: number;
  differenceNote?: string;
}): Promise<ActionResult<PhysicalPackage>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data: row, error } = await supabase
      .from("shipment_packages")
      .select(PACKAGE_SELECT)
      .eq("organization_id", session.organizationId)
      .eq("code", input.code.trim())
      .maybeSingle();
    if (error || !row) return fail("No encontramos una caja con ese código.");
    const pkg = mapPackage(row as PackageDbRow);
    if (pkg.status !== "pending_intake") {
      return fail("Esta caja no está pendiente de ingreso a bodega.");
    }
    const intakeWeight = Number(input.weightKg);
    if (!Number.isFinite(intakeWeight) || intakeWeight <= 0) {
      return fail("Indica un peso válido en kg.");
    }
    const toleranceResult = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", session.organizationId)
      .single();
    const settings = (toleranceResult.data?.settings || {}) as Record<string, unknown>;
    const tolerance = Math.max(0, Number(settings.warehouse_weight_tolerance_kg) || 0);
    const difference =
      pkg.collectionWeightKg === null ? null : Math.abs(intakeWeight - pkg.collectionWeightKg);
    const note = String(input.differenceNote || "").trim();
    if (difference !== null && difference > tolerance && !note) {
      return fail(
        `La diferencia de ${difference.toFixed(2)} kg supera el margen permitido (${tolerance.toFixed(2)} kg). Indica el motivo.`,
      );
    }
    const { error: updateError } = await supabase
      .from("shipment_packages")
      .update({
        intake_weight_kg: intakeWeight,
        intake_recorded_at: new Date().toISOString(),
        intake_recorded_by: session.userId,
        weight_difference_kg: difference,
        weight_difference_note: note,
        status: "warehouse_intake",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pkg.id)
      .eq("organization_id", session.organizationId);
    if (updateError) return fail(updateError.message);
    await recordActivityHistory(supabase, session, {
      action: "package.warehouse_intake",
      entityType: "shipment",
      entityId: pkg.shipmentId,
      title: `Ingreso a bodega · ${pkg.code}`,
      description: `${intakeWeight.toFixed(2)} kg registrados al ingresar.`,
      metadata: {
        packageId: pkg.id,
        packageCode: pkg.code,
        intakeWeightKg: intakeWeight,
        differenceKg: difference,
      },
    });
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    revalidatePath("/seguimiento");
    return ok({
      ...pkg,
      intakeWeightKg: intakeWeight,
      weightDifferenceKg: difference,
      weightDifferenceNote: note,
      status: "warehouse_intake" as const,
    });
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
  packageCount: number;
};

export async function listWarehouseTruckArrivalsAction(): Promise<ActionResult<WarehouseTruckArrival[]>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase
      .from("shipment_packages")
      .select(
        "truck_route_id, truck_arrived_at, logistics_routes(id, name, assigned_to, logistics_vehicles(name), profiles:assigned_to(full_name))",
      )
      .eq("organization_id", session.organizationId)
      .eq("status", "in_truck")
      .not("truck_route_id", "is", null);
    if (error) return fail(error.message);
    const arrivals = new Map<string, WarehouseTruckArrival>();
    for (const row of data || []) {
      const route = row.logistics_routes as unknown as Record<string, unknown> | null;
      const routeId = String(row.truck_route_id || "");
      if (!routeId) continue;
      const current = arrivals.get(routeId);
      if (current) {
        current.packageCount += 1;
        continue;
      }
      const vehicle = route?.logistics_vehicles as Record<string, unknown> | null;
      const driver = route?.profiles as Record<string, unknown> | null;
      arrivals.set(routeId, {
        routeId,
        routeName: String(route?.name || "Ruta finalizada"),
        vehicleName: String(vehicle?.name || "Camión"),
        driverName: String(driver?.full_name || "Sin conductor"),
        arrivedAt: (row.truck_arrived_at as string | null) || null,
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

export async function unloadTruckToWarehouseIntakeAction(
  routeId: string,
): Promise<ActionResult<PhysicalPackage[]>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("shipment_packages")
      .update({
        status: "pending_intake",
        truck_unloaded_at: now,
        truck_unloaded_by: session.userId,
        updated_at: now,
      })
      .eq("organization_id", session.organizationId)
      .eq("truck_route_id", routeId)
      .eq("status", "in_truck")
      .select(PACKAGE_SELECT);
    if (error) return fail(error.message);
    if (!data?.length) return fail("Ese camión no tiene cajas pendientes de descargar.");
    revalidatePath("/ingreso-bodega");
    revalidatePath("/bodega");
    return ok(data.map(mapPackage));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function returnPhysicalPackageToTruckAction(
  packageId: string,
): Promise<ActionResult<PhysicalPackage>> {
  try {
    const session = await requireAppSession();
    if (!canOperateWarehouse(session)) throw new Error("FORBIDDEN");
    const supabase = await createScopedSupabase(session);
    if (!supabase) return fail("Supabase no configurado");
    const { data, error } = await supabase
      .from("shipment_packages")
      .update({
        status: "in_truck",
        intake_weight_kg: null,
        intake_recorded_at: null,
        intake_recorded_by: null,
        weight_difference_kg: null,
        weight_difference_note: "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", packageId)
      .eq("organization_id", session.organizationId)
      .eq("status", "pending_intake")
      .not("truck_route_id", "is", null)
      .select(PACKAGE_SELECT)
      .maybeSingle();
    if (error || !data) {
      return fail(
        error?.message || "La caja debe estar pendiente de ingreso y pertenecer a un camión.",
      );
    }
    revalidatePath("/ingreso-bodega");
    return ok(mapPackage(data));
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
