import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isClosedLogisticsStatus, splitLogisticsTasksByOpenState } from "./logistics-view";

describe("logistics view", () => {
  it("keeps active logistics tasks in one open list", () => {
    const split = splitLogisticsTasksByOpenState([
      { id: "pending", status: "pending" },
      { id: "scheduled", status: "scheduled" },
      { id: "assigned", status: "assigned" },
      { id: "loaded", status: "loaded_to_truck" },
      { id: "done", status: "completed" },
      { id: "cancelled", status: "cancelled" },
    ]);

    assert.deepEqual(
      split.open.map((task) => task.id),
      ["pending", "scheduled", "assigned", "loaded"],
    );
    assert.deepEqual(
      split.closed.map((task) => task.id),
      ["done", "cancelled"],
    );
  });

  it("only treats completed and cancelled as closed", () => {
    assert.equal(isClosedLogisticsStatus("completed"), true);
    assert.equal(isClosedLogisticsStatus("cancelled"), true);
    assert.equal(isClosedLogisticsStatus("assigned"), false);
  });
});
