import type { RoleSlug } from "@/lib/auth/types";

export const LOGISTICS_VEHICLE_PHOTO_BUCKET = "logistics-vehicle-photos";
export const LOGISTICS_VEHICLE_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const LOGISTICS_VEHICLE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type LogisticsDriverRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  vehicleId: string | null;
  vehicleName: string;
  vehiclePlate: string;
};

export type LogisticsVehicleRow = {
  id: string;
  name: string;
  plate: string;
  photoUrl: string;
  cargoBoxSize: string;
  cargoCapacity: string;
  notes: string;
  assignedDriverId: string | null;
  assignedDriverName: string;
  assignedDriverEmail: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LogisticsVehicleInput = {
  name: string;
  plate?: string;
  photoUrl?: string;
  cargoBoxSize?: string;
  cargoCapacity?: string;
  notes?: string;
  assignedDriverId?: string | null;
};

export type LogisticsDriverInput = {
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
};

export type AssignableDriverCandidate = {
  id: string;
  roleSlug: RoleSlug | string;
  isActive: boolean;
};

export type VehicleAssignmentState = {
  id: string;
  assignedDriverId: string | null;
  isActive: boolean;
};

export type NormalizedLogisticsVehicleInput = {
  name: string;
  plate: string;
  photoUrl: string;
  cargoBoxSize: string;
  cargoCapacity: string;
  notes: string;
  assignedDriverId: string | null;
};

export type NormalizedLogisticsDriverInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function cleanFleetText(value: unknown, maxLength = 160) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function normalizeVehiclePlate(value: unknown) {
  return cleanFleetText(value, 24)
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function normalizeDriverEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validateLogisticsDriverInput(
  input: LogisticsDriverInput,
  options?: { requirePassword?: boolean },
): ValidationResult<NormalizedLogisticsDriverInput> {
  const email = normalizeDriverEmail(input.email);
  const password = String(input.password || "");
  const fullName = cleanFleetText(input.fullName, 120);
  const phone = cleanFleetText(input.phone, 40);

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Correo invalido" };
  }

  if (options?.requirePassword && password.length < 6) {
    return { ok: false, error: "Contrasena minima: 6 caracteres" };
  }

  return {
    ok: true,
    data: {
      email,
      password,
      fullName,
      phone,
    },
  };
}

export function validateLogisticsVehicleInput(
  input: LogisticsVehicleInput,
): ValidationResult<NormalizedLogisticsVehicleInput> {
  const name = cleanFleetText(input.name, 120);
  const plate = normalizeVehiclePlate(input.plate);
  const photoUrl = cleanFleetText(input.photoUrl, 600);
  const cargoBoxSize = cleanFleetText(input.cargoBoxSize, 120);
  const cargoCapacity = cleanFleetText(input.cargoCapacity, 120);
  const notes = cleanFleetText(input.notes, 500);
  const assignedDriverId = cleanFleetText(input.assignedDriverId, 80) || null;

  if (!name) {
    return { ok: false, error: "Nombre requerido" };
  }

  if (!plate) {
    return { ok: false, error: "Placa requerida" };
  }

  if (!cargoBoxSize) {
    return { ok: false, error: "Tamano de volco requerido" };
  }

  if (!cargoCapacity) {
    return { ok: false, error: "Capacidad requerida" };
  }

  return {
    ok: true,
    data: {
      name,
      plate,
      photoUrl,
      cargoBoxSize,
      cargoCapacity,
      notes,
      assignedDriverId,
    },
  };
}

export function assertAssignableVehicleDriver(
  driverId: string | null,
  drivers: AssignableDriverCandidate[],
) {
  if (!driverId) {
    return;
  }

  const driver = drivers.find((entry) => entry.id === driverId);

  if (!driver || !driver.isActive || driver.roleSlug !== "conductor") {
    throw new Error("Conductor no valido");
  }
}

export function moveVehicleDriverAssignment(
  vehicles: VehicleAssignmentState[],
  vehicleId: string,
  assignedDriverId: string | null,
) {
  return vehicles.map((vehicle) => {
    if (vehicle.id === vehicleId) {
      return { ...vehicle, assignedDriverId };
    }

    if (assignedDriverId && vehicle.isActive && vehicle.assignedDriverId === assignedDriverId) {
      return { ...vehicle, assignedDriverId: null };
    }

    return vehicle;
  });
}

export function logisticsDriverRouteOption(driver: Pick<LogisticsDriverRow, "id" | "fullName" | "email" | "isActive">) {
  if (!driver.isActive) {
    return null;
  }

  return {
    id: driver.id,
    label: driver.fullName || driver.email,
    roleSlug: "conductor" as const,
  };
}

export function validateVehiclePhoto(file: Pick<File, "size" | "type">): ValidationResult<null> {
  if (file.size > LOGISTICS_VEHICLE_PHOTO_MAX_BYTES) {
    return { ok: false, error: "Foto maxima: 4MB" };
  }

  if (!LOGISTICS_VEHICLE_PHOTO_TYPES.includes(file.type as (typeof LOGISTICS_VEHICLE_PHOTO_TYPES)[number])) {
    return { ok: false, error: "Foto debe ser JPG, PNG o WebP" };
  }

  return { ok: true, data: null };
}
