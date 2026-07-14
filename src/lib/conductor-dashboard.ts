import type { ConductorDriverTask } from "@/lib/conductor-tasks";

export type ConductorTaskSummary = {
  deliverCount: number;
  pickupCount: number;
  totalTasks: number;
};

export type ConductorCompletedOutcomeSummary = {
  successCount: number;
  failedCount: number;
  successBoxes: number;
  failedBoxes: number;
};

function conductorTaskBoxQuantity(
  task: Pick<ConductorDriverTask, "boxLines">,
): number {
  const total = task.boxLines.reduce(
    (sum, line) => sum + Math.max(Number(line.quantity) || 0, 0),
    0,
  );

  return total > 0 ? total : 1;
}

export function summarizeConductorTasks(
  tasks: ReadonlyArray<ConductorDriverTask>,
): ConductorTaskSummary {
  let deliverCount = 0;
  let pickupCount = 0;

  for (const task of tasks) {
    const boxQty = conductorTaskBoxQuantity(task);

    if (task.taskType === "deliver_empty_box") {
      deliverCount += boxQty;
    } else if (task.taskType === "pickup_full_box") {
      pickupCount += boxQty;
    }
  }

  return {
    deliverCount,
    pickupCount,
    totalTasks: tasks.length,
  };
}

export function summarizeConductorCompletedOutcomes(
  tasks: ReadonlyArray<ConductorDriverTask>,
): ConductorCompletedOutcomeSummary {
  let successCount = 0;
  let failedCount = 0;
  let successBoxes = 0;
  let failedBoxes = 0;

  for (const task of tasks) {
    const boxQty = conductorTaskBoxQuantity(task);

    if (task.status === "completed") {
      successCount += 1;
      successBoxes += boxQty;
      continue;
    }

    if (task.status === "cancelled") {
      failedCount += 1;
      failedBoxes += boxQty;
    }
  }

  return {
    successCount,
    failedCount,
    successBoxes,
    failedBoxes,
  };
}
