import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  saleLogisticsFeesFromRouteConfig,
  salePricingFromConfig,
} from "@/lib/pricing/sale-derivatives";
import { emptyRouteConfig } from "@/lib/pricing/load-config";

describe("loadVentaBootstrap pricing derivation", () => {
  it("builds sale pricing and logistics fees from one pricing config payload", () => {
    const pricing = salePricingFromConfig(
      [
        {
          code: "US",
          name: "USA",
          deliveryTime: "3 dias",
          boxes: [{ size: "Medium", price: "$50", cost: "$10", catalogKey: "medium" }],
        },
      ],
      [],
    );

    const fees = saleLogisticsFeesFromRouteConfig({
      ...emptyRouteConfig,
      minimumDeposit: "$40",
    });

    assert.ok(pricing.countryBoxes.USA);
    assert.equal(fees.minimumDeposit, "$40");
  });
});
