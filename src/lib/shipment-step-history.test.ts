import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ActivityHistoryRow } from "@/app/actions/history";
import { buildAuditHistorySegments, stepHistoryEntryDetail, stepHistoryEntryTitle } from "./shipment-step-history";
import { SHIPMENT_SCHEDULE_UPDATED_ACTION } from "./shipment-schedule-history";

function historyEntry(overrides: Partial<ActivityHistoryRow> = {}): ActivityHistoryRow {
  return {
    id: "entry-1",
    organizationId: "org-1",
    actorId: "user-1",
    actorName: "Pablo",
    action: "shipment.logistics_task_updated",
    entityType: "shipment",
    entityId: "shipment-1",
    title: "Tarea logistica: completed",
    description: "INV-000001 · pickup_full_box",
    metadata: {},
    createdAt: "2026-03-11T16:00:00.000Z",
    ...overrides,
  };
}

describe("shipment-step-history logistics durations", () => {
  it("shows elapsed time from order to completion", () => {
    const detail = stepHistoryEntryDetail(
      historyEntry({
        metadata: {
          status: "completed",
          orderedAt: "2026-03-09T08:00:00.000Z",
          completedAt: "2026-03-11T16:00:00.000Z",
        },
      }),
    );

    assert.match(detail, /Completada 2 días después de ordenarse en envíos/);
  });

  it("shows elapsed time from order to assignment", () => {
    const detail = stepHistoryEntryDetail(
      historyEntry({
        metadata: {
          status: "assigned",
          orderedAt: "2026-03-09T08:00:00.000Z",
          assignedAt: "2026-03-10T09:00:00.000Z",
        },
      }),
    );

    assert.match(detail, /Asignada 1 día después de ordenarse en envíos/);
  });
});

describe("buildAuditHistorySegments", () => {
  it("splits logistics descriptions into readable chunks", () => {
    const segments = buildAuditHistorySegments(
      historyEntry({
        action: "shipment.logistics_task_ordered",
        description:
          "Menú contextual - Entrega de caja vacía · Ordenada 2026-07-05T08:51:00.000Z · Paso: Dejar",
      }),
    );

    assert.equal(
      segments.some((segment) => segment.type === "text" && segment.value === "Entrega de caja vacía"),
      true,
    );
    assert.equal(segments.some((segment) => segment.type === "date"), true);
    assert.equal(segments.some((segment) => segment.type === "moment" && segment.value === "Dejar"), true);
    assert.equal(
      segments.some((segment) => segment.type === "actor" && segment.value === "Pablo"),
      true,
    );
  });

  it("labels priority changes with actor", () => {
    const segments = buildAuditHistorySegments(
      historyEntry({
        action: "sale.invoice_priority_updated",
        title: "Prioridad invoice: INV-000001",
        description: "Marcado como prioridad",
      }),
    );

    assert.equal(segments[0]?.type === "text" && segments[0].value, "Marcado como prioridad");
    assert.equal(
      segments.some((segment) => segment.type === "actor" && segment.value === "Pablo"),
      true,
    );
  });

  it("shows schedule changes with before, after and actor", () => {
    const detail = stepHistoryEntryDetail(
      historyEntry({
        action: SHIPMENT_SCHEDULE_UPDATED_ACTION,
        metadata: {
          beforeScheduleLabel: "5 de julio de 2026 desde 10:00 AM",
          afterScheduleLabel: "6 de julio de 2026 desde 2:00 PM",
        },
      }),
    );

    assert.match(detail, /5 de julio de 2026/);
    assert.match(detail, /6 de julio de 2026/);
    assert.equal(stepHistoryEntryTitle(historyEntry({ action: SHIPMENT_SCHEDULE_UPDATED_ACTION })), "Cambio de fecha");

    const segments = buildAuditHistorySegments(
      historyEntry({
        action: SHIPMENT_SCHEDULE_UPDATED_ACTION,
        description:
          "5 de julio de 2026 desde 10:00 AM → 6 de julio de 2026 desde 2:00 PM · Paso: Programar entrega",
      }),
    );

    assert.equal(segments.filter((segment) => segment.type === "date").length, 2);
    assert.equal(
      segments.some((segment) => segment.type === "actor" && segment.value === "Pablo"),
      true,
    );
  });
});
