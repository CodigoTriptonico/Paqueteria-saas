import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  saleLogisticsFeesFromRouteConfig,
  salePricingFromConfig,
} from "@/lib/pricing/sale-derivatives";
import type { PricingCountryConfig, PricingRouteConfig } from "@/lib/pricing/types";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";

const countries: PricingCountryConfig[] = [
  {
    code: "US",
    name: "USA",
    deliveryTime: "3 dias",
    boxes: [{ size: "Medium", price: "$50", cost: "$10", catalogKey: "medium" }],
  },
];

const routeConfig: PricingRouteConfig = {
  deliveryDays: [],
  pickupDays: [],
  deliveryRanges: [],
  pickupRanges: [],
  pendingAllowed: true,
  routeLeadTime: "",
  linkedRouteSchedules: false,
  emptyBoxDeliveryFee: "$15",
  fullBoxPickupFee: "$10",
  minimumDeposit: "$25",
  logisticsFeeMode: "per_trip",
};

describe("salePricingFromConfig", () => {
  it("derives country boxes and active promotions from one pricing payload", () => {
    const promotions: PricingPromotionConfig[] = [
      {
        id: "p1",
        countryName: "USA",
        name: "Combo",
        active: true,
        catalogKey: "medium",
        sortOrder: 0,
        rule: { mode: "bundle_price", buy: [], get: [], bundlePrice: "$40" },
      },
      {
        id: "p2",
        countryName: "USA",
        name: "Off",
        active: false,
        catalogKey: "medium",
        sortOrder: 1,
        rule: { mode: "bundle_price", buy: [], get: [], bundlePrice: "$40" },
      },
    ];

    const result = salePricingFromConfig(countries, promotions);

    assert.deepEqual(Object.keys(result.countryBoxes), ["USA"]);
    assert.equal(result.promotions.length, 1);
    assert.equal(result.promotions[0]?.name, "Combo");
  });

  it("includes configured countries even when they have no priced items yet", () => {
    const result = salePricingFromConfig(
      [
        ...countries,
        {
          code: "MX",
          name: "Mexico",
          deliveryTime: "5 dias",
          boxes: [],
        },
      ],
      [],
    );

    assert.deepEqual(Object.keys(result.countryBoxes).sort(), ["Mexico", "USA"]);
    assert.deepEqual(result.countryBoxes.Mexico, []);
  });
});

describe("saleLogisticsFeesFromRouteConfig", () => {
  it("derives logistics fees without reloading pricing tables", () => {
    const fees = saleLogisticsFeesFromRouteConfig(routeConfig);

    assert.equal(fees.minimumDeposit, "$25");
    assert.equal(fees.logisticsFeeMode, "per_trip");
  });
});
