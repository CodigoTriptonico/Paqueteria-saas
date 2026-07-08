import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLogisticsTaskEditPatch,
  canEditLogisticsTaskFields,
  logisticsTaskEditDisabledReason,
  logisticsTaskEditDraftFromTask,
  logisticsTaskEditScheduleValid,
} from "@/lib/logistics-task-edit";

describe("logistics-task-edit", () => {
  it("blocks closed tasks and warehouse after stock deduction", () => {
    assert.equal(canEditLogisticsTaskFields({ status: "completed" }), false);
    assert.equal(canEditLogisticsTaskFields({ status: "assigned" }), true);
    assert.equal(
      logisticsTaskEditDisabledReason(
        { status: "assigned", stockDeductedAt: "2026-07-08T10:00:00.000Z" },
        "warehouse",
      ),
      "Stock ya descontado de bodega",
    );
    assert.equal(
      logisticsTaskEditDisabledReason(
        { status: "assigned", stockDeductedAt: "2026-07-08T10:00:00.000Z" },
        "notes",
      ),
      null,
    );
  });

  it("builds pending and scheduled patches", () => {
    const pending = buildLogisticsTaskEditPatch(
      {
        scheduleMode: "pending",
        routeDate: "2026-07-08",
        routeTime: "10:00",
        warehouseId: "wh-1",
        notes: "  nota  ",
      },
      null,
    );

    assert.equal(pending.scheduledAt, null);
    assert.equal(pending.warehouseId, "wh-1");
    assert.equal(pending.notes, "nota");

    const scheduled = buildLogisticsTaskEditPatch(
      {
        scheduleMode: "scheduled",
        routeDate: "2026-07-08",
        routeTime: "14:00",
        warehouseId: null,
        notes: "",
      },
      null,
    );

    assert.match(scheduled.scheduledAt || "", /2026-07-08/);
    assert.equal(logisticsTaskEditScheduleValid({
      scheduleMode: "scheduled",
      routeDate: "2026-07-08",
      routeTime: "14:00-16:00",
      warehouseId: null,
      notes: "",
    }), true);
  });

  it("hydrates draft from scheduled task", () => {
    const draft = logisticsTaskEditDraftFromTask({
      scheduledAt: "2026-07-08T18:30:00.000Z",
      warehouseId: "wh-2",
      notes: "llamar antes",
    });

    assert.equal(draft.scheduleMode, "scheduled");
    assert.equal(draft.warehouseId, "wh-2");
    assert.equal(draft.notes, "llamar antes");
    assert.match(draft.routeDate, /^\d{4}-\d{2}-\d{2}$/);
  });
});
