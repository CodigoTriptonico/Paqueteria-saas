import type { LogisticsVehicleRow } from "@/lib/logistics-fleet";

export function suggestVehicleIdForDriver(
  vehicles: ReadonlyArray<Pick<LogisticsVehicleRow, "id" | "assignedDriverId" | "isActive">>,
  driverId: string | null,
): string | null {
  if (!driverId) {
    return null;
  }

  const match = vehicles.find(
    (vehicle) => vehicle.isActive && vehicle.assignedDriverId === driverId,
  );

  return match?.id || null;
}

export function vehicleDisplayLabel(
  vehicle: Pick<LogisticsVehicleRow, "name" | "plate"> | null | undefined,
) {
  if (!vehicle) {
    return null;
  }

  return vehicle.plate ? `${vehicle.name} · ${vehicle.plate}` : vehicle.name;
}
