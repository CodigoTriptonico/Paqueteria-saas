import type { ConductorDriverTask } from "@/lib/conductor-tasks";

export type ConductorTaskSummary = {
  deliverCount: number;
  pickupCount: number;
  addressCount: number;
  totalTasks: number;
};

export function conductorTaskAddressKey(task: ConductorDriverTask): string | null {
  const address = task.addressLine?.trim();
  if (address) {
    return address.toLowerCase();
  }

  const zone = task.zoneLabel?.trim();
  if (zone) {
    return `zone:${zone.toLowerCase()}`;
  }

  return null;
}

export function summarizeConductorTasks(
  tasks: ReadonlyArray<ConductorDriverTask>,
): ConductorTaskSummary {
  let deliverCount = 0;
  let pickupCount = 0;
  const addresses = new Set<string>();

  for (const task of tasks) {
    if (task.taskType === "deliver_empty_box") {
      deliverCount += 1;
    } else if (task.taskType === "pickup_full_box") {
      pickupCount += 1;
    }

    const key = conductorTaskAddressKey(task);
    if (key) {
      addresses.add(key);
    }
  }

  return {
    deliverCount,
    pickupCount,
    addressCount: addresses.size,
    totalTasks: tasks.length,
  };
}
