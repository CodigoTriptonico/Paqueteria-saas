import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLogisticsKpis } from "@/lib/logistics-kpis";

describe("logistics-kpis", () => {
  it("computes route and task kpis", () => {
    const kpis = computeLogisticsKpis({
      routes: [
        { status: "completed", stops: [] },
        { status: "planned", stops: [{ id: "1" } as never] },
      ],
      tasks: [
        { status: "completed" },
        { status: "cancelled" },
        { status: "assigned" },
      ],
    });

    assert.equal(kpis.completedRoutes, 1);
    assert.equal(kpis.plannedRoutes, 1);
    assert.equal(kpis.failedTasks, 1);
    assert.equal(kpis.openTasks, 1);
    assert.equal(kpis.failureRate, 0.5);
  });
});
