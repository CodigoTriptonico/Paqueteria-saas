import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeWeightedAverageCost,
  resolveEntryCostForSubmit,
  syncEntryCostFields,
} from "@/lib/inventory-entry-cost";

describe("inventory entry cost", () => {
  it("syncs unit cost from total cost and quantity", () => {
    assert.deepEqual(
      syncEntryCostFields({
        qty: "500",
        unitCost: "",
        totalCost: "2250",
        anchor: "total",
      }),
      {
        unitCost: "4.5",
        totalCost: "2250",
      },
    );
  });

  it("syncs total cost from unit cost and quantity", () => {
    assert.deepEqual(
      syncEntryCostFields({
        qty: "500",
        unitCost: "4.5",
        totalCost: "",
        anchor: "unit",
      }),
      {
        unitCost: "4.5",
        totalCost: "2250",
      },
    );
  });

  it("recomputes costs when quantity changes and total cost is anchored", () => {
    assert.deepEqual(
      syncEntryCostFields({
        qty: "100",
        unitCost: "4.5",
        totalCost: "2250",
        anchor: "qty",
      }),
      {
        unitCost: "22.5",
        totalCost: "2250",
      },
    );
  });

  it("allows empty costs on submit", () => {
    assert.deepEqual(
      resolveEntryCostForSubmit({
        qty: 10,
        unitCost: "",
        totalCost: "",
      }),
      { ok: true, unitCost: null, totalCost: null },
    );
  });

  it("resolves missing total cost from unit cost", () => {
    assert.deepEqual(
      resolveEntryCostForSubmit({
        qty: 4,
        unitCost: "2.5",
        totalCost: "",
      }),
      { ok: true, unitCost: 2.5, totalCost: 10 },
    );
  });

  it("resolves missing unit cost from total cost", () => {
    assert.deepEqual(
      resolveEntryCostForSubmit({
        qty: 4,
        unitCost: "",
        totalCost: "10",
      }),
      { ok: true, unitCost: 2.5, totalCost: 10 },
    );
  });

  it("computes weighted average cost on entrada", () => {
    assert.equal(
      computeWeightedAverageCost({
        currentStock: 100,
        currentAvgCost: 5,
        entryQty: 50,
        entryUnitCost: 8,
      }),
      6,
    );
  });
});
