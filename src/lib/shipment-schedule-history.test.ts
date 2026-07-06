import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyScheduleChangeMetadata,
  detectLegScheduleChanges,
  describeScheduleAuditChange,
  hasLogisticsPlanChangeBesidesSchedule,
  legHasScheduleChange,
  normalizeScheduleAtKey,
  scheduleHistoryDetailFromMetadata,
} from "./shipment-schedule-history";

describe("shipment-schedule-history", () => {
  it("detects schedule-only changes on driver legs", () => {
    const before = {
      emptyBox: {
        mode: "Programar entrega de caja vacia",
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-05T10:00",
      },
    };
    const after = {
      emptyBox: {
        mode: "Programar entrega de caja vacia",
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-06T14:00",
      },
    };

    const changes = detectLegScheduleChanges(before, after);

    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.legKey, "emptyBox");
    assert.equal(changes[0]?.beforeScheduleAt, "2026-07-05T10:00");
    assert.equal(changes[0]?.afterScheduleAt, "2026-07-06T14:00");
  });

  it("stores original schedule metadata when date changes", () => {
    const before = {
      emptyBox: {
        mode: "Programar entrega de caja vacia",
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-05T10:00",
      },
    };
    const after = {
      emptyBox: {
        mode: "Programar entrega de caja vacia",
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-06T14:00",
      },
    };

    const enriched = applyScheduleChangeMetadata(before, after, "Felipe arango", "2026-07-05T20:00:00.000Z");
    const leg = enriched.emptyBox as Record<string, unknown>;

    assert.equal(legHasScheduleChange(leg), true);
    assert.equal(leg.originalScheduleAt, "2026-07-05T10:00");
    assert.equal(leg.scheduleChangedBy, "Felipe arango");
    assert.equal(leg.scheduleChangeCount, 1);
  });

  it("treats equal schedule strings as unchanged", () => {
    assert.equal(
      normalizeScheduleAtKey("2026-07-05T10:00"),
      normalizeScheduleAtKey("2026-07-05T10:00"),
    );
    assert.notEqual(
      normalizeScheduleAtKey("2026-07-05T10:00"),
      normalizeScheduleAtKey("2026-07-06T10:00"),
    );
  });

  it("describes schedule audit changes in Spanish", () => {
    const description = describeScheduleAuditChange({
      beforeScheduleAt: "2026-07-05T10:00",
      afterScheduleAt: "2026-07-06T14:00",
      stepTitle: "Dejar",
    });

    assert.match(description, /5 de julio de 2026/);
    assert.match(description, /6 de julio de 2026/);
    assert.match(description, /Dejar/);
  });

  it("knows when logistics changes are schedule-only", () => {
    const before = {
      emptyBox: {
        mode: "Programar entrega de caja vacia",
        scheduleMode: "scheduled",
        scheduleAt: "2026-07-05T10:00",
      },
    };
    const after = applyScheduleChangeMetadata(
      before,
      {
        emptyBox: {
          mode: "Programar entrega de caja vacia",
          scheduleMode: "scheduled",
          scheduleAt: "2026-07-06T14:00",
        },
      },
      "Pablo",
      "2026-07-05T20:00:00.000Z",
    );

    assert.equal(hasLogisticsPlanChangeBesidesSchedule(before, after), false);
  });

  it("builds history detail from metadata", () => {
    const detail = scheduleHistoryDetailFromMetadata({
      beforeScheduleLabel: "5 de julio de 2026 desde 10:00 AM",
      afterScheduleLabel: "6 de julio de 2026 desde 2:00 PM",
    });

    assert.equal(
      detail,
      "5 de julio de 2026 desde 10:00 AM → 6 de julio de 2026 desde 2:00 PM",
    );
  });
});
