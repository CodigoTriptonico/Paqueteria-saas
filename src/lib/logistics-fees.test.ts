import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeLogisticsFees,
  formatMoneyValue,
  logisticsDriverFeeLabel,
  normalizeMoneyInput,
  parseMoneyValue,
} from "./logistics-fees";

describe("logistics-fees", () => {
  it("parses and formats money values", () => {
    assert.equal(parseMoneyValue("$15.50"), 15.5);
    assert.equal(formatMoneyValue(15.5), "$15.50");
    assert.equal(normalizeMoneyInput("20"), "$20");
  });

  it("charges driver fees for selected logistics legs", () => {
    const fees = {
      emptyBoxDeliveryFee: "$12",
      fullBoxPickupFee: "$8",
    };

    assert.deepEqual(
      computeLogisticsFees({
        emptyBoxDriver: true,
        fullBoxDriver: false,
        fees,
      }).totalLabel,
      "$12",
    );

    assert.deepEqual(
      computeLogisticsFees({
        emptyBoxDriver: true,
        fullBoxDriver: true,
        fees,
      }).totalLabel,
      "$20",
    );

    assert.deepEqual(
      computeLogisticsFees({
        emptyBoxDriver: false,
        fullBoxDriver: false,
        fees,
      }).totalLabel,
      "$0",
    );
  });

  it("multiplies driver fees per box when configured", () => {
    assert.equal(
      computeLogisticsFees({
        emptyBoxDriver: true,
        fullBoxDriver: true,
        fees: {
          emptyBoxDeliveryFee: "$12",
          fullBoxPickupFee: "$8",
        },
        boxCount: 3,
        logisticsFeeMode: "per_box",
      }).totalLabel,
      "$60",
    );
  });

  it("shows driver fee labels only when fee is positive", () => {
    assert.equal(logisticsDriverFeeLabel("$0"), "");
    assert.equal(logisticsDriverFeeLabel("$15"), "$15");
  });
});
