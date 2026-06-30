import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFirstMilestonePatch,
  milestoneKeyForLogisticsTask,
  milestoneKeyForStatus,
  newlyRecordedMilestones,
  readShipmentMilestones,
  shipmentMilestoneAuditPayload,
  SHIPMENT_MILESTONE_ACTION,
} from "./shipment-milestones";

describe("shipment-milestones", () => {
  it("maps shipment status to milestone column", () => {
    assert.equal(milestoneKeyForStatus("En oficina"), "office_received_at");
    assert.equal(milestoneKeyForStatus("Pickup"), "departed_at");
    assert.equal(milestoneKeyForStatus("Enviado"), "shipped_at");
    assert.equal(milestoneKeyForStatus("Entregado"), "delivered_at");
    assert.equal(milestoneKeyForStatus("Pendiente"), null);
  });

  it("maps logistics tasks to milestone column", () => {
    assert.equal(milestoneKeyForLogisticsTask("deliver_empty_box"), "empty_box_delivered_at");
    assert.equal(milestoneKeyForLogisticsTask("pickup_full_box"), "full_box_collected_at");
  });

  it("builds patch only for milestones not yet set", () => {
    const patch = buildFirstMilestonePatch(
      { office_received_at: "2026-01-01T00:00:00.000Z" },
      [
        { key: "office_received_at", recordedAt: "2026-02-01T00:00:00.000Z" },
        { key: "departed_at", recordedAt: "2026-02-02T00:00:00.000Z" },
      ],
    );

    assert.deepEqual(patch, {
      departed_at: "2026-02-02T00:00:00.000Z",
    });
  });

  it("lists newly recorded milestones from patch", () => {
    const fresh = newlyRecordedMilestones(
      { shipped_at: null },
      { shipped_at: "2026-03-01T12:00:00.000Z", delivered_at: "2026-03-02T12:00:00.000Z" },
    );

    assert.equal(fresh.length, 2);
    assert.equal(fresh[0]?.key, "shipped_at");
    assert.equal(fresh[1]?.key, "delivered_at");
  });

  it("builds structured audit payload for milestone events", () => {
    const payload = shipmentMilestoneAuditPayload({
      shipmentId: "ship-1",
      shipmentCode: "INV-001",
      milestone: "delivered_at",
      recordedAt: "2026-03-02T12:00:00.000Z",
      source: "status_update",
      previousStatus: "Enviado",
      nextStatus: "Entregado",
      customerName: "Ana",
      country: "Mexico",
    });

    assert.equal(payload.action, SHIPMENT_MILESTONE_ACTION);
    assert.match(payload.title, /INV-001/);
    assert.equal(payload.metadata.milestone, "delivered_at");
    assert.equal(payload.metadata.source, "status_update");
    assert.equal(payload.metadata.nextStatus, "Entregado");
  });

  it("simulates status update writing milestone only once", () => {
    const before = readShipmentMilestones({
      office_received_at: "2026-01-15T10:00:00.000Z",
      departed_at: null,
      shipped_at: null,
      delivered_at: null,
      empty_box_delivered_at: null,
      full_box_collected_at: null,
    });

    const firstPatch = buildFirstMilestonePatch(before, [
      { key: "departed_at", recordedAt: "2026-01-16T10:00:00.000Z" },
    ]);
    const afterFirst = { ...before, ...firstPatch };
    const secondPatch = buildFirstMilestonePatch(afterFirst, [
      { key: "departed_at", recordedAt: "2026-01-20T10:00:00.000Z" },
    ]);

    assert.deepEqual(firstPatch, { departed_at: "2026-01-16T10:00:00.000Z" });
    assert.deepEqual(secondPatch, {});
  });
});
