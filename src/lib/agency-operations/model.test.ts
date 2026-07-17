import assert from "node:assert/strict";
import test from "node:test";
import {
  agencyRequestOutcome,
  allocateAgencyBoxesFifo,
  confirmAgencyVisitLines,
  isAgencyRequestTransitionAllowed,
} from "./model";

test("request transitions reject skipping operational custody", () => {
  assert.equal(isAgencyRequestTransitionAllowed("draft", "submitted"), true);
  assert.equal(isAgencyRequestTransitionAllowed("draft", "completed"), false);
  assert.equal(isAgencyRequestTransitionAllowed("completed", "cancelled"), false);
});

test("visit confirmation requires a reason for any quantity difference", () => {
  assert.throws(
    () => confirmAgencyVisitLines([{
      id: "line-1",
      kind: "empty_box_delivery",
      requestedQuantity: 10,
      confirmedQuantity: 8,
    }]),
    /requiere motivo/,
  );

  const [confirmed] = confirmAgencyVisitLines([{
    id: "line-1",
    kind: "empty_box_delivery",
    requestedQuantity: 10,
    confirmedQuantity: 8,
    differenceReason: "La agencia recibio solo ocho",
  }]);
  assert.equal(confirmed.differenceQuantity, -2);
  assert.equal(agencyRequestOutcome([confirmed]), "partially_completed");
});

test("exact visit confirmation completes the request", () => {
  const lines = confirmAgencyVisitLines([{
    id: "line-1",
    kind: "full_box_pickup",
    requestedQuantity: 3,
    confirmedQuantity: 3,
  }]);
  assert.equal(agencyRequestOutcome(lines), "completed");
});

test("matrix boxes allocate from the oldest available lots", () => {
  const result = allocateAgencyBoxesFifo({
    source: "matrix_purchased",
    quantity: 5,
    lots: [
      { id: "new", deliveredAt: "2026-07-10T00:00:00Z", deliveredQuantity: 5, allocatedQuantity: 0 },
      { id: "old", deliveredAt: "2026-07-01T00:00:00Z", deliveredQuantity: 4, allocatedQuantity: 1 },
    ],
  });

  assert.deepEqual(result, {
    allocations: [
      { lotId: "old", quantity: 3 },
      { lotId: "new", quantity: 2 },
    ],
    unfulfilledQuantity: 0,
  });
});

test("own boxes never consume matrix lots", () => {
  const result = allocateAgencyBoxesFifo({
    source: "own_box",
    quantity: 99,
    lots: [{ id: "lot", deliveredAt: "2026-07-01T00:00:00Z", deliveredQuantity: 10, allocatedQuantity: 0 }],
  });
  assert.deepEqual(result, { allocations: [], unfulfilledQuantity: 0 });
});

test("insufficient matrix inventory remains visible and does not fabricate stock", () => {
  const result = allocateAgencyBoxesFifo({
    source: "matrix_purchased",
    quantity: 4,
    lots: [{ id: "lot", deliveredAt: "2026-07-01T00:00:00Z", deliveredQuantity: 2, allocatedQuantity: 1 }],
  });
  assert.deepEqual(result, {
    allocations: [{ lotId: "lot", quantity: 1 }],
    unfulfilledQuantity: 3,
  });
});

test("quantities are safe non-negative integers", () => {
  assert.throws(
    () => allocateAgencyBoxesFifo({ source: "matrix_purchased", quantity: 1.5, lots: [] }),
    /entero no negativo/,
  );
  assert.throws(
    () => confirmAgencyVisitLines([{ id: "x", kind: "home_delivery", requestedQuantity: -1, confirmedQuantity: 0 }]),
    /entero no negativo/,
  );
});
