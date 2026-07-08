export function parseVehicleCargoCapacity(value: string | null | undefined) {
  const match = String(value || "").match(/(\d+)/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function routeStopsWithinVehicleCapacity(
  stopCount: number,
  cargoCapacity: string | null | undefined,
) {
  const capacity = parseVehicleCargoCapacity(cargoCapacity);

  if (!capacity) {
    return true;
  }

  return stopCount <= capacity;
}

export function pickFleetCargoCapacityLimit(
  vehicles: ReadonlyArray<{ cargoCapacity: string }>,
) {
  let best: { capacity: number; raw: string } | null = null;

  for (const vehicle of vehicles) {
    const capacity = parseVehicleCargoCapacity(vehicle.cargoCapacity);

    if (!capacity) {
      continue;
    }

    if (!best || capacity > best.capacity) {
      best = { capacity, raw: vehicle.cargoCapacity };
    }
  }

  return best?.raw ?? null;
}
