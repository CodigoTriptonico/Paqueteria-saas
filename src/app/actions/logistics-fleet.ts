"use server";

import { randomUUID } from "node:crypto";
import { requireAppSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import {
  LOGISTICS_VEHICLE_PHOTO_BUCKET,
  assertAssignableVehicleDriver,
  normalizeDriverEmail,
  validateLogisticsDriverInput,
  validateLogisticsVehicleInput,
  validateVehiclePhoto,
  type AssignableDriverCandidate,
  type LogisticsDriverInput,
  type LogisticsDriverRow,
  type LogisticsVehicleInput,
  type LogisticsVehicleRow,
} from "@/lib/logistics-fleet";
import type { AppSession, RoleSlug } from "@/lib/auth/types";

export type {
  LogisticsDriverInput,
  LogisticsDriverRow,
  LogisticsVehicleInput,
  LogisticsVehicleRow,
} from "@/lib/logistics-fleet";

type Supabase = NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>;

type RoleJoin = { slug: RoleSlug; name?: string } | { slug: RoleSlug; name?: string }[] | null;

type DriverProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  roles: RoleJoin;
};

type VehicleDbRow = {
  id: string;
  name: string;
  plate: string;
  photo_url: string;
  cargo_box_size: string;
  cargo_capacity: string;
  notes: string;
  assigned_driver_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DriverLabelRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  roles?: RoleJoin;
};

function canManageFleet(session: AppSession) {
  return session.roleSlug === "administrador" || (session.isPlatformAdmin && session.isActingAsClient);
}

function roleSlug(row: { roles: RoleJoin }) {
  const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  return role?.slug || "vendedor";
}

function driverLabel(row: Pick<DriverLabelRow, "email" | "full_name"> | null | undefined) {
  return ((row?.full_name || row?.email || "") as string).trim();
}

async function requireFleetSession() {
  const session = await requireAppSession();

  if (!canManageFleet(session)) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

async function loadConductorRoleId(supabase: Supabase, session: AppSession) {
  const { data, error } = await supabase
    .from("roles")
    .select("id")
    .eq("organization_id", session.organizationId)
    .eq("slug", "conductor")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Rol conductor no encontrado");
  }

  return data.id as string;
}

async function loadDriverCandidates(supabase: Supabase, session: AppSession) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_active, roles(slug)")
    .eq("organization_id", session.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    isActive: row.is_active === true,
    roleSlug: roleSlug(row as { roles: RoleJoin }),
  })) satisfies AssignableDriverCandidate[];
}

async function assertDriverCanBeAssigned(
  supabase: Supabase,
  session: AppSession,
  driverId: string | null,
) {
  if (!driverId) {
    return;
  }

  assertAssignableVehicleDriver(driverId, await loadDriverCandidates(supabase, session));
}

async function clearDriverFromOtherVehicles(
  supabase: Supabase,
  session: AppSession,
  assignedDriverId: string | null,
  keepVehicleId?: string,
) {
  if (!assignedDriverId) {
    return;
  }

  let query = supabase
    .from("logistics_vehicles")
    .update({ assigned_driver_id: null, updated_at: new Date().toISOString() })
    .eq("organization_id", session.organizationId)
    .eq("is_active", true)
    .eq("assigned_driver_id", assignedDriverId);

  if (keepVehicleId) {
    query = query.neq("id", keepVehicleId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

function mapVehicle(row: VehicleDbRow, driverById: Map<string, DriverLabelRow>): LogisticsVehicleRow {
  const driver = row.assigned_driver_id ? driverById.get(row.assigned_driver_id) : null;

  return {
    id: row.id,
    name: row.name,
    plate: row.plate,
    photoUrl: row.photo_url,
    cargoBoxSize: row.cargo_box_size,
    cargoCapacity: row.cargo_capacity,
    notes: row.notes,
    assignedDriverId: row.assigned_driver_id,
    assignedDriverName: driverLabel(driver),
    assignedDriverEmail: driver?.email || "",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadVehicleRows(supabase: Supabase, session: AppSession) {
  const { data, error } = await supabase
    .from("logistics_vehicles")
    .select("id, name, plate, photo_url, cargo_box_size, cargo_capacity, notes, assigned_driver_id, is_active, created_at, updated_at")
    .eq("organization_id", session.organizationId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as VehicleDbRow[];
}

async function loadDriverLabels(
  supabase: Supabase,
  session: AppSession,
  driverIds: string[],
) {
  const ids = Array.from(new Set(driverIds.filter(Boolean)));

  if (!ids.length) {
    return new Map<string, DriverLabelRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_active")
    .eq("organization_id", session.organizationId)
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data || []) as DriverLabelRow[]).map((row) => [row.id, row]));
}

function duplicateFleetMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505" && error.message?.includes("idx_logistics_vehicles_org_plate_unique")) {
    return "Ya existe un vehiculo con esa placa";
  }

  if (error.code === "23505" && error.message?.includes("idx_logistics_vehicles_driver_unique")) {
    return "Ese conductor ya tiene vehiculo asignado";
  }

  return error.message || "No se pudo guardar";
}

export async function listLogisticsDriversAction(): Promise<ActionResult<LogisticsDriverRow[]>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const [{ data, error }, vehicleRows] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, phone, is_active, created_at, roles(slug, name)")
        .eq("organization_id", session.organizationId)
        .eq("is_active", true)
        .order("full_name"),
      loadVehicleRows(supabase, session),
    ]);

    if (error) {
      return fail(error.message);
    }

    const vehicleByDriverId = new Map(
      vehicleRows
        .filter((vehicle) => vehicle.assigned_driver_id)
        .map((vehicle) => [
          vehicle.assigned_driver_id as string,
          { id: vehicle.id, name: vehicle.name, plate: vehicle.plate },
        ]),
    );

    const drivers = ((data || []) as DriverProfileRow[])
      .filter((row) => roleSlug(row) === "conductor")
      .map((row) => {
        const vehicle = vehicleByDriverId.get(row.id);
        return {
          id: row.id,
          email: row.email,
          fullName: row.full_name || "",
          phone: row.phone || "",
          isActive: row.is_active,
          createdAt: row.created_at,
          vehicleId: vehicle?.id || null,
          vehicleName: vehicle?.name || "",
          vehiclePlate: vehicle?.plate || "",
        } satisfies LogisticsDriverRow;
      });

    return ok(drivers);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createLogisticsDriverAction(
  input: LogisticsDriverInput,
): Promise<ActionResult<LogisticsDriverRow>> {
  let createdUserId = "";

  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);
    const admin = createSupabaseAdminClient();

    if (!supabase || !admin) {
      return fail("Supabase no configurado");
    }

    const validation = validateLogisticsDriverInput(input, { requirePassword: true });
    if (!validation.ok) {
      return fail(validation.error);
    }

    const roleId = await loadConductorRoleId(supabase, session);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return fail(createError?.message || "No se pudo crear conductor");
    }

    createdUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      organization_id: session.organizationId,
      email: validation.data.email,
      full_name: validation.data.fullName || null,
      phone: validation.data.phone || null,
      role_id: roleId,
      is_active: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(profileError.message);
    }

    await recordActivityHistory(admin, session, {
      action: "logistics.driver_created",
      entityType: "profile",
      entityId: created.user.id,
      title: `Conductor creado: ${validation.data.fullName || validation.data.email}`,
      metadata: { email: validation.data.email },
    });

    const driver: LogisticsDriverRow = {
      id: created.user.id,
      email: validation.data.email,
      fullName: validation.data.fullName,
      phone: validation.data.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      vehicleId: null,
      vehicleName: "",
      vehiclePlate: "",
    };

    return ok(driver);
  } catch (error) {
    if (createdUserId) {
      await createSupabaseAdminClient()?.auth.admin.deleteUser(createdUserId);
    }

    return fail(actionErrorMessage(error));
  }
}

export async function updateLogisticsDriverAction(input: {
  driverId: string;
  email: string;
  fullName?: string;
  phone?: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);
    const admin = createSupabaseAdminClient();

    if (!supabase || !admin) {
      return fail("Supabase no configurado");
    }

    const validation = validateLogisticsDriverInput(input);
    if (!validation.ok) {
      return fail(validation.error);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, roles(slug)")
      .eq("id", input.driverId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (profileError) {
      return fail(profileError.message);
    }

    if (!profile || roleSlug(profile as { roles: RoleJoin }) !== "conductor") {
      return fail("Conductor no encontrado");
    }

    if (normalizeDriverEmail(profile.email) !== validation.data.email) {
      const { error: authError } = await admin.auth.admin.updateUserById(input.driverId, {
        email: validation.data.email,
        email_confirm: true,
      });

      if (authError) {
        return fail(authError.message);
      }
    }

    const { error } = await admin
      .from("profiles")
      .update({
        email: validation.data.email,
        full_name: validation.data.fullName || null,
        phone: validation.data.phone || null,
      })
      .eq("id", input.driverId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    await recordActivityHistory(admin, session, {
      action: "logistics.driver_updated",
      entityType: "profile",
      entityId: input.driverId,
      title: `Conductor actualizado: ${validation.data.fullName || validation.data.email}`,
      metadata: { email: validation.data.email },
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateLogisticsDriverAction(driverId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);
    const admin = createSupabaseAdminClient();

    if (!supabase || !admin) {
      return fail("Supabase no configurado");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, roles(slug)")
      .eq("id", driverId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (profileError) {
      return fail(profileError.message);
    }

    if (!profile || roleSlug(profile as { roles: RoleJoin }) !== "conductor") {
      return fail("Conductor no encontrado");
    }

    const { error } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", driverId)
      .eq("organization_id", session.organizationId);

    if (error) {
      return fail(error.message);
    }

    await admin
      .from("logistics_vehicles")
      .update({ assigned_driver_id: null, updated_at: new Date().toISOString() })
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .eq("assigned_driver_id", driverId);

    await recordActivityHistory(admin, session, {
      action: "logistics.driver_deactivated",
      entityType: "profile",
      entityId: driverId,
      title: `Conductor desactivado: ${driverLabel(profile as DriverLabelRow)}`,
      metadata: { email: (profile as DriverLabelRow).email },
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function resetLogisticsDriverPasswordAction(input: {
  driverId: string;
  password: string;
}): Promise<ActionResult<null>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);
    const admin = createSupabaseAdminClient();

    if (!supabase || !admin) {
      return fail("Supabase no configurado");
    }

    if (input.password.length < 6) {
      return fail("Contrasena minima: 6 caracteres");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, roles(slug)")
      .eq("id", input.driverId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!profile || roleSlug(profile as { roles: RoleJoin }) !== "conductor") {
      return fail("Conductor no encontrado");
    }

    const { error } = await admin.auth.admin.updateUserById(input.driverId, {
      password: input.password,
    });

    if (error) {
      return fail(error.message);
    }

    await recordActivityHistory(admin, session, {
      action: "logistics.driver_password_reset",
      entityType: "profile",
      entityId: input.driverId,
      title: "Contrasena de conductor actualizada",
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listLogisticsVehiclesAction(): Promise<ActionResult<LogisticsVehicleRow[]>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const rows = await loadVehicleRows(supabase, session);
    const driverById = await loadDriverLabels(
      supabase,
      session,
      rows.map((row) => row.assigned_driver_id || ""),
    );

    return ok(rows.map((row) => mapVehicle(row, driverById)));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createLogisticsVehicleAction(
  input: LogisticsVehicleInput,
): Promise<ActionResult<LogisticsVehicleRow>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const validation = validateLogisticsVehicleInput(input);
    if (!validation.ok) {
      return fail(validation.error);
    }

    await assertDriverCanBeAssigned(supabase, session, validation.data.assignedDriverId);
    await clearDriverFromOtherVehicles(supabase, session, validation.data.assignedDriverId);

    const { data, error } = await supabase
      .from("logistics_vehicles")
      .insert({
        organization_id: session.organizationId,
        name: validation.data.name,
        plate: validation.data.plate,
        photo_url: validation.data.photoUrl,
        cargo_box_size: validation.data.cargoBoxSize,
        cargo_capacity: validation.data.cargoCapacity,
        notes: validation.data.notes,
        assigned_driver_id: validation.data.assignedDriverId,
      })
      .select("id, name, plate, photo_url, cargo_box_size, cargo_capacity, notes, assigned_driver_id, is_active, created_at, updated_at")
      .single();

    if (error || !data) {
      return fail(duplicateFleetMessage(error || {}));
    }

    const driverById = await loadDriverLabels(
      supabase,
      session,
      [validation.data.assignedDriverId || ""],
    );
    const vehicle = mapVehicle(data as VehicleDbRow, driverById);

    await recordActivityHistory(supabase, session, {
      action: "logistics.vehicle_created",
      entityType: "logistics_vehicle",
      entityId: vehicle.id,
      title: `Vehiculo creado: ${vehicle.name}`,
      description: vehicle.plate,
      metadata: { assignedDriverId: vehicle.assignedDriverId },
    });

    return ok(vehicle);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateLogisticsVehicleAction(input: {
  vehicleId: string;
  data: LogisticsVehicleInput;
}): Promise<ActionResult<LogisticsVehicleRow>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const validation = validateLogisticsVehicleInput(input.data);
    if (!validation.ok) {
      return fail(validation.error);
    }

    await assertDriverCanBeAssigned(supabase, session, validation.data.assignedDriverId);
    await clearDriverFromOtherVehicles(
      supabase,
      session,
      validation.data.assignedDriverId,
      input.vehicleId,
    );

    const { data, error } = await supabase
      .from("logistics_vehicles")
      .update({
        name: validation.data.name,
        plate: validation.data.plate,
        photo_url: validation.data.photoUrl,
        cargo_box_size: validation.data.cargoBoxSize,
        cargo_capacity: validation.data.cargoCapacity,
        notes: validation.data.notes,
        assigned_driver_id: validation.data.assignedDriverId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.vehicleId)
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .select("id, name, plate, photo_url, cargo_box_size, cargo_capacity, notes, assigned_driver_id, is_active, created_at, updated_at")
      .single();

    if (error || !data) {
      return fail(duplicateFleetMessage(error || {}));
    }

    const driverById = await loadDriverLabels(
      supabase,
      session,
      [validation.data.assignedDriverId || ""],
    );
    const vehicle = mapVehicle(data as VehicleDbRow, driverById);

    await recordActivityHistory(supabase, session, {
      action: "logistics.vehicle_updated",
      entityType: "logistics_vehicle",
      entityId: vehicle.id,
      title: `Vehiculo actualizado: ${vehicle.name}`,
      description: vehicle.plate,
      metadata: { assignedDriverId: vehicle.assignedDriverId },
    });

    return ok(vehicle);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateLogisticsVehicleAction(vehicleId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireFleetSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("logistics_vehicles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", vehicleId)
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .select("id, name, plate, assigned_driver_id")
      .single();

    if (error || !data) {
      return fail(error?.message || "Vehiculo no encontrado");
    }

    await recordActivityHistory(supabase, session, {
      action: "logistics.vehicle_deactivated",
      entityType: "logistics_vehicle",
      entityId: vehicleId,
      title: `Vehiculo eliminado: ${String(data.name || "")}`,
      description: String(data.plate || ""),
      metadata: { assignedDriverId: data.assigned_driver_id || null },
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function uploadLogisticsVehiclePhotoAction(
  formData: FormData,
): Promise<ActionResult<string>> {
  try {
    const session = await requireFleetSession();
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return fail("Supabase no configurado");
    }

    const file = formData.get("photo");

    if (!(file instanceof File) || !file.name) {
      return fail("Foto requerida");
    }

    const validation = validateVehiclePhoto(file);
    if (!validation.ok) {
      return fail(validation.error);
    }

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
    const path = `${session.organizationId}/${randomUUID()}.${extension}`;
    const { error } = await admin.storage
      .from(LOGISTICS_VEHICLE_PHOTO_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return fail(error.message);
    }

    const { data } = admin.storage.from(LOGISTICS_VEHICLE_PHOTO_BUCKET).getPublicUrl(path);

    return ok(data.publicUrl);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
