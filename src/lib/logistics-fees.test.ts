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

  it("keeps driver fees at zero", () => {
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
      "$0",
    );

    assert.deepEqual(
      computeLogisticsFees({
        emptyBoxDriver: true,
        fullBoxDriver: true,
        fees,
      }).totalLabel,
      "$0",
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

  it("does not show driver fee labels", () => {
    assert.equal(logisticsDriverFeeLabel("$0"), "");
    assert.equal(logisticsDriverFeeLabel("$15"), "");
  });
});
