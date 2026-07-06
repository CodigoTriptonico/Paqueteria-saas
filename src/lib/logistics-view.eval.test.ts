import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveLogisticsInvoiceStep, shouldConfirmDriverReplacement } from "./logistics-view";

type EvalTask = {
  id: string;
  taskType: "deliver_empty_box" | "pickup_full_box";
  status: "pending" | "scheduled" | "assigned" | "loaded_to_truck" | "completed" | "cancelled";
  assignedTo: string | null;
};

function task(input: EvalTask): EvalTask {
  return input;
}

describe("logistics invoice step eval", () => {
  it("confirms any driver assignment change", () => {
    const scenarios = [
      { current: null, next: "driver-a", expected: true, name: "first assignment" },
      { current: "driver-a", next: null, expected: true, name: "unassign" },
      { current: "driver-a", next: "driver-a", expected: false, name: "same driver" },
      { current: "driver-a", next: "driver-b", expected: true, name: "replacement" },
    ];

    for (const scenario of scenarios) {
      assert.equal(
        shouldConfirmDriverReplacement(scenario.current, scenario.next),
        scenario.expected,
        scenario.name,
      );
    }
  });

  it("keeps only the current actionable invoice step assignable", () => {
    const scenarios = [
      {
        name: "empty box pending without driver",
        tasks: [
          task({
            id: "empty",
            taskType: "deliver_empty_box",
            status: "pending",
            assignedTo: null,
          }),
          task({
            id: "full",
            taskType: "pickup_full_box",
            status: "pending",
            assignedTo: null,
          }),
        ],
        expected: {
          stepType: "deliver_empty_box",
          currentTaskId: "empty",
          nextTaskId: "full",
          assignment: "unassigned",
          canAssignDriver: true,
        },
      },
      {
        name: "empty box assigned hides pickup assignment",
        tasks: [
          task({
            id: "empty",
            taskType: "deliver_empty_box",
            status: "assigned",
            assignedTo: "driver-a",
          }),
          task({
            id: "full",
            taskType: "pickup_full_box",
            status: "assigned",
            assignedTo: "driver-b",
          }),
        ],
        expected: {
          stepType: "deliver_empty_box",
          currentTaskId: "empty",
          nextTaskId: "full",
          assignment: "assigned",
          canAssignDriver: true,
        },
      },
      {
        name: "pickup opens after empty box completed",
        tasks: [
          task({
            id: "empty",
            taskType: "deliver_empty_box",
            status: "completed",
            assignedTo: "driver-a",
          }),
          task({
            id: "full",
            taskType: "pickup_full_box",
            status: "pending",
            assignedTo: null,
          }),
        ],
        expected: {
          stepType: "pickup_full_box",
          currentTaskId: "full",
          nextTaskId: null,
          assignment: "unassigned",
          canAssignDriver: true,
        },
      },
    ];

    for (const scenario of scenarios) {
      const step = resolveLogisticsInvoiceStep({ logisticsTasks: scenario.tasks });

      assert.deepEqual(
        {
          stepType: step?.stepType,
          currentTaskId: step?.currentTask?.id ?? null,
          nextTaskId: step?.nextTask?.id ?? null,
          assignment: step?.assignment,
          canAssignDriver: step?.canAssignDriver,
        },
        scenario.expected,
        scenario.name,
      );
    }
  });
});
