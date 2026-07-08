import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPricingRpcPayload, validatePricingConfigPayload } from "@/lib/pricing/rpc-payload";
import type { PricingConfigPayload } from "@/lib/pricing/types";

const basePayload = (): PricingConfigPayload => ({
  countries: [
    {
      code: "MX",
      name: "Mexico",
      deliveryTime: "3 dias",
      boxes: [{ size: "Small", price: "$10", cost: "$5" }],
    },
  ],
  promotions: [],
  distributors: [{ name: "Carrier A", contact: "", phone: "", active: true }],
  distributorPrices: {},
  routeConfig: {
    deliveryDays: [],
    pickupDays: [],
    deliveryRanges: [],
    pickupRanges: [],
    pendingAllowed: true,
    routeLeadTime: "",
    linkedRouteSchedules: false,
    emptyBoxDeliveryFee: "$0",
    fullBoxPickupFee: "$0",
    minimumDeposit: "$20",
    logisticsFeeMode: "per_trip",
  },
  catalogProducts: [],
});

describe("pricing rpc payload", () => {
  it("rejects negative prices before rpc", () => {
    const payload = basePayload();
    payload.countries[0].boxes[0].price = "-$1";
    assert.throws(() => validatePricingConfigPayload(payload), /Precio invalido/);
  });

  it("builds rpc payload with sanitized country names", () => {
    const payload = basePayload();
    const rpcPayload = buildPricingRpcPayload(payload);
    assert.equal(rpcPayload.countries[0]?.name, "Mexico");
    assert.equal(rpcPayload.countries[0]?.boxes[0]?.price, "$10");
  });
});
