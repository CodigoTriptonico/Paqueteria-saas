import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceSingleProductBundleRule,
  describeComboRule,
  evaluateComboDiscount,
  isBundlePromotionEligible,
  isPromotionRuleValid,
  legacyPromotionToRule,
  quoteCombosForCart,
  quotePromotionsForBox,
  type ComboCartLine,
  type PricingPromotionConfig,
} from "./combo-rules";

function promo(id: string, rule: PricingPromotionConfig["rule"]): PricingPromotionConfig {
  return {
    id,
    countryName: "Mexico",
    name: id,
    active: true,
    rule,
    catalogKey: rule.buy[0]?.catalogKey || "",
    sortOrder: 0,
  };
}

describe("combo-rules", () => {
  it("migrates bundle price legacy rule", () => {
    const rule = legacyPromotionToRule({
      catalog_key: "box|large",
      promotion_type: "bundle_price",
      bundle_quantity: 2,
      bundle_price: "$90",
      paid_quantity: 2,
      discounted_quantity: 1,
      discount_percent: 100,
    });

    const discount = evaluateComboDiscount({
      cart: [{ catalogKey: "box|large", quantity: 2, unitPrice: "$50" }],
      rule,
    });

    assert.equal(discount, 10);
  });

  it("applies third-free style legacy rule", () => {
    const rule = legacyPromotionToRule({
      catalog_key: "box|large",
      promotion_type: "extra_discount",
      bundle_quantity: 2,
      bundle_price: "$0",
      paid_quantity: 2,
      discounted_quantity: 1,
      discount_percent: 100,
    });

    const discount = evaluateComboDiscount({
      cart: [{ catalogKey: "box|large", quantity: 3, unitPrice: "$50" }],
      rule,
    });

    assert.equal(discount, 50);
  });

  it("supports mixed-product buy with discount on another product", () => {
    const promotion = promo("mix", {
      mode: "reward",
      buy: [
        { id: "b1", catalogKey: "box|large", quantity: 2 },
      ],
      get: [
        {
          id: "g1",
          catalogKey: "box|small",
          quantity: 1,
          kind: "percent_off",
          percent: 50,
          target: "same_purchase",
        },
      ],
      repeat: false,
    });

    const discount = evaluateComboDiscount({
      cart: [
        { catalogKey: "box|large", quantity: 2, unitPrice: "$70" },
        { catalogKey: "box|small", quantity: 1, unitPrice: "$40" },
      ],
      rule: promotion.rule,
    });

    assert.equal(discount, 20);
  });

  it("supports next-unit discount on any product", () => {
    const promotion = promo("next-any", {
      mode: "reward",
      buy: [
        { id: "b1", catalogKey: "box|small", quantity: 1 },
        { id: "b2", catalogKey: "box|large", quantity: 1 },
      ],
      get: [
        {
          id: "g1",
          catalogKey: "*",
          quantity: 1,
          kind: "percent_off",
          percent: 30,
          target: "next_unit",
        },
      ],
      repeat: false,
    });

    const cart: ComboCartLine[] = [
      { catalogKey: "box|small", quantity: 1, unitPrice: "$40" },
      { catalogKey: "box|large", quantity: 1, unitPrice: "$70" },
      { catalogKey: "box|large", quantity: 1, unitPrice: "$70" },
    ];

    const discount = evaluateComboDiscount({ cart, rule: promotion.rule });
    assert.equal(discount, 21);
  });

  it("quotes promotions for homogeneous cart", () => {
    const promotion = promo("bundle", legacyPromotionToRule({
      catalog_key: "box|large",
      promotion_type: "bundle_price",
      bundle_quantity: 2,
      bundle_price: "$90",
      paid_quantity: 2,
      discounted_quantity: 1,
      discount_percent: 100,
    }));

    const quotes = quotePromotionsForBox({
      boxCount: 2,
      boxUnitPrice: "$50",
      catalogKey: "box|large",
      promotions: [promotion],
    });

    assert.equal(quotes.length, 1);
    assert.equal(quotes[0]?.discountTotal, "$10");
  });

  it("applies buy 2 x get y free", () => {
    const promotion = promo("x-y-free", {
      mode: "reward",
      buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
      get: [
        {
          id: "g1",
          catalogKey: "box|small",
          quantity: 1,
          kind: "percent_off",
          percent: 100,
          target: "same_purchase",
        },
      ],
      repeat: true,
    });

    const discount = evaluateComboDiscount({
      cart: [
        { catalogKey: "box|large", quantity: 2, unitPrice: "$100" },
        { catalogKey: "box|small", quantity: 1, unitPrice: "$50" },
      ],
      rule: promotion.rule,
    });

    assert.equal(discount, 50);
  });

  it("applies 3 x get fourth half off", () => {
    const promotion = promo("fourth-half", {
      mode: "reward",
      buy: [{ id: "b1", catalogKey: "box|large", quantity: 3 }],
      get: [
        {
          id: "g1",
          catalogKey: "box|large",
          quantity: 1,
          kind: "percent_off",
          percent: 50,
          target: "next_unit",
        },
      ],
      repeat: true,
    });

    const discount = evaluateComboDiscount({
      cart: [{ catalogKey: "box|large", quantity: 4, unitPrice: "$80" }],
      rule: promotion.rule,
    });

    assert.equal(discount, 40);
  });

  it("applies mixed x plus y bundle price", () => {
    const promotion = promo("bundle-mixed", {
      mode: "bundle_price",
      buy: [
        { id: "b1", catalogKey: "box|x", quantity: 1 },
        { id: "b2", catalogKey: "box|y", quantity: 1 },
      ],
      get: [],
      bundlePrice: "$250",
      repeat: true,
    });

    const quotes = quoteCombosForCart({
      cart: [
        { catalogKey: "box|x", quantity: 1, unitPrice: "$100" },
        { catalogKey: "box|y", quantity: 1, unitPrice: "$200" },
      ],
      promotions: [promotion],
    });

    assert.equal(quotes[0]?.discountTotal, "$50");
  });

  it("repeats 2x1 without discounting the same unit twice", () => {
    const promotion = promo("2x1", {
      mode: "reward",
      buy: [{ id: "b1", catalogKey: "box|large", quantity: 1 }],
      get: [
        {
          id: "g1",
          catalogKey: "box|large",
          quantity: 1,
          kind: "percent_off",
          percent: 100,
          target: "next_unit",
        },
      ],
      repeat: true,
    });

    const discount = evaluateComboDiscount({
      cart: [{ catalogKey: "box|large", quantity: 4, unitPrice: "$50" }],
      rule: promotion.rule,
    });

    assert.equal(discount, 100);
  });

  it("does not discount a missing reward unit", () => {
    const promotion = promo("2x1-single", {
      mode: "reward",
      buy: [{ id: "b1", catalogKey: "box|large", quantity: 1 }],
      get: [
        {
          id: "g1",
          catalogKey: "box|large",
          quantity: 1,
          kind: "percent_off",
          percent: 100,
          target: "next_unit",
        },
      ],
      repeat: true,
    });

    const discount = evaluateComboDiscount({
      cart: [{ catalogKey: "box|large", quantity: 1, unitPrice: "$50" }],
      rule: promotion.rule,
    });

    assert.equal(discount, 0);
  });

  it("describes reward rules in plain Spanish", () => {
    const labels = { chica: "Caja chiquita", jumbo: "Caja jumbo" };

    assert.equal(
      describeComboRule(
        {
          mode: "reward",
          buy: [{ id: "b1", catalogKey: "chica", quantity: 2 }],
          get: [
            {
              id: "g1",
              catalogKey: "chica",
              quantity: 1,
              kind: "percent_off",
              percent: 20,
              target: "same_purchase",
            },
          ],
          repeat: true,
        },
        labels,
      ),
      "Compra 2× Caja chiquita → 20% en 1 unidad · varias veces",
    );

    assert.equal(
      describeComboRule(
        {
          mode: "reward",
          buy: [{ id: "b1", catalogKey: "chica", quantity: 1 }],
          get: [
            {
              id: "g1",
              catalogKey: "chica",
              quantity: 1,
              kind: "percent_off",
              percent: 100,
              target: "same_purchase",
            },
          ],
          repeat: false,
        },
        labels,
      ),
      "Compra 1× Caja chiquita → 1 gratis · una vez por venta",
    );

    assert.equal(
      describeComboRule(
        {
          mode: "reward",
          buy: [{ id: "b1", catalogKey: "chica", quantity: 2 }],
          get: [
            {
              id: "g1",
              catalogKey: "chica",
              quantity: 1,
              kind: "percent_off",
              percent: 20,
              target: "same_purchase",
            },
          ],
          repeat: false,
        },
        labels,
      ),
      "Compra 2× Caja chiquita → 20% en 1 unidad · una vez por venta",
    );

    assert.equal(
      describeComboRule(
        {
          mode: "reward",
          buy: [
            { id: "b1", catalogKey: "chica", quantity: 1 },
            { id: "b2", catalogKey: "jumbo", quantity: 1 },
          ],
          get: [
            {
              id: "g1",
              catalogKey: "jumbo",
              quantity: 1,
              kind: "percent_off",
              percent: 100,
              target: "same_purchase",
            },
          ],
          repeat: true,
        },
        labels,
      ),
      "Compra 1× Caja chiquita + 1× Caja jumbo → 1× Caja jumbo gratis · varias veces",
    );
  });

  it("rejects incomplete or zero-value promotion rules", () => {
    assert.equal(
      isPromotionRuleValid({
        mode: "reward",
        buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
        get: [
          {
            id: "g1",
            catalogKey: "box|large",
            quantity: 1,
            kind: "percent_off",
            percent: 0,
            target: "same_purchase",
          },
        ],
        repeat: true,
      }),
      false,
    );

    assert.equal(
      isPromotionRuleValid({
        mode: "reward",
        buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
        get: [
          {
            id: "g1",
            catalogKey: "box|small",
            quantity: 1,
            kind: "fixed_unit_price",
            amount: "",
            target: "same_purchase",
          },
        ],
        repeat: true,
      }),
      false,
    );

    assert.equal(
      isPromotionRuleValid({
        mode: "bundle_price",
        buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
        get: [],
        bundlePrice: "$0",
        repeat: true,
      }),
      false,
    );

    assert.equal(
      isPromotionRuleValid({
        mode: "bundle_price",
        buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
        get: [],
        bundlePrice: "$90",
        repeat: true,
      }),
      false,
    );

    assert.equal(
      isBundlePromotionEligible({
        buy: [
          { id: "b1", catalogKey: "box|large", quantity: 1 },
          { id: "b2", catalogKey: "box|small", quantity: 1 },
        ],
      }),
      true,
    );

    const coerced = coerceSingleProductBundleRule({
      mode: "bundle_price",
      buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
      get: [],
      bundlePrice: "$90",
      repeat: true,
    });

    assert.equal(coerced.mode, "reward");
    assert.equal(coerced.get[0]?.kind, "set_total");
    assert.equal(coerced.get[0]?.amount, "$90");

    assert.equal(
      isPromotionRuleValid({
        mode: "reward",
        buy: [{ id: "b1", catalogKey: "box|large", quantity: 2 }],
        get: [
          {
            id: "g1",
            catalogKey: "box|small",
            quantity: 1,
            kind: "percent_off",
            percent: 100,
            target: "same_purchase",
          },
        ],
        repeat: true,
      }),
      true,
    );
  });
});
