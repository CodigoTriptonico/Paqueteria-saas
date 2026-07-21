import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  billingWithRecordedPayment,
  computeInvoiceBilling,
  invoiceAccountingStateForPayment,
  invoicePaymentKindForCurrentDeposit,
  readBillingFromPlan,
  saleFinishActionLabel,
} from "./invoice-billing";
import type { PricingPromotionConfig } from "./pricing-promotions";
import { legacyPromotionToRule } from "./combo-rules";

const fees = {
  emptyBoxDeliveryFee: "$15",
  fullBoxPickupFee: "$10",
  minimumDeposit: "$20",
  logisticsFeeMode: "per_trip" as const,
};

const bundlePromo: PricingPromotionConfig = {
  id: "promo-bundle",
  countryName: "Mexico",
  catalogKey: "box|large",
  name: "2 por 90",
  active: true,
  sortOrder: 0,
  rule: legacyPromotionToRule({
    catalog_key: "box|large",
    promotion_type: "bundle_price",
    bundle_quantity: 2,
    bundle_price: "$90",
    paid_quantity: 2,
    discounted_quantity: 1,
    discount_percent: 100,
  }),
};

const thirdFreePromo: PricingPromotionConfig = {
  id: "promo-free",
  countryName: "Mexico",
  catalogKey: "box|large",
  name: "Tercera gratis",
  active: true,
  sortOrder: 1,
  rule: legacyPromotionToRule({
    catalog_key: "box|large",
    promotion_type: "extra_discount",
    bundle_quantity: 2,
    bundle_price: "$0",
    paid_quantity: 2,
    discounted_quantity: 1,
    discount_percent: 100,
  }),
};

const fourthHalfPromo: PricingPromotionConfig = {
  id: "promo-half",
  countryName: "Mexico",
  catalogKey: "box|large",
  name: "Cuarta mitad",
  active: true,
  sortOrder: 2,
  rule: legacyPromotionToRule({
    catalog_key: "box|large",
    promotion_type: "extra_discount",
    bundle_quantity: 2,
    bundle_price: "$0",
    paid_quantity: 3,
    discounted_quantity: 1,
    discount_percent: 50,
  }),
};

const mixedBundlePromo: PricingPromotionConfig = {
  id: "promo-mixed",
  countryName: "Mexico",
  catalogKey: "box|x",
  name: "X + Y 250",
  active: true,
  sortOrder: 0,
  rule: {
    mode: "bundle_price",
    buy: [
      { id: "b1", catalogKey: "box|x", quantity: 1 },
      { id: "b2", catalogKey: "box|y", quantity: 1 },
    ],
    get: [],
    bundlePrice: "$250",
    repeat: true,
  },
};

describe("invoice-billing", () => {
  it("totals box without logistics fees", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$150",
      emptyBoxDriver: true,
      fullBoxDriver: true,
      fees,
    });

    assert.equal(billing.logisticsSubtotal, "$0");
    assert.equal(billing.quotedTotal, "$150");
    assert.equal(billing.payNow, "$20");
    assert.equal(billing.depositRequired, "$20");
    assert.equal(billing.depositStatus, "pending");
    assert.equal(billing.balanceDue, "$130");
  });

  it("multiplies box price by box count", () => {
    const billing = computeInvoiceBilling({
      boxCount: 3,
      boxUnitPrice: "$50",
      emptyBoxDriver: true,
      fullBoxDriver: false,
      fees: { ...fees, logisticsFeeMode: "per_box" },
    });

    assert.equal(billing.boxSubtotal, "$150");
    assert.equal(billing.emptyBoxDelivery, "$0");
    assert.equal(billing.quotedTotal, "$150");
  });

  it("allows paying more than the minimum deposit", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$150",
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
      payNow: 100,
    });

    assert.equal(billing.payNow, "$100");
    assert.equal(billing.balanceDue, "$50");
  });

  it("caps pay now at quoted total", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$30",
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
      payNow: 500,
    });

    assert.equal(billing.payNow, "$30");
    assert.equal(billing.balanceDue, "$0");
  });

  it("allows zero deposit when explicitly set", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$100",
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
      payNow: 0,
    });

    assert.equal(billing.payNow, "$0");
    assert.equal(billing.balanceDue, "$100");
  });

  it("allows deposit below configured minimum when explicitly set", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$100",
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
      payNow: 2,
    });

    assert.equal(billing.payNow, "$2");
    assert.equal(billing.balanceDue, "$98");
  });

  it("applies 2 boxes for a special price", () => {
    const billing = computeInvoiceBilling({
      boxCount: 2,
      boxUnitPrice: "$50",
      catalogKey: "box|large",
      promotions: [bundlePromo],
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(billing.boxSubtotalBeforeDiscount, "$100");
    assert.equal(billing.promotionDiscount, "$10");
    assert.equal(billing.boxSubtotal, "$90");
    assert.equal(billing.quotedTotal, "$90");
    assert.equal(billing.promotion?.name, "2 por 90");
  });

  it("repeats special price groups and charges remainder normal", () => {
    const billing = computeInvoiceBilling({
      boxCount: 5,
      boxUnitPrice: "$50",
      catalogKey: "box|large",
      promotions: [bundlePromo],
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(billing.boxSubtotalBeforeDiscount, "$250");
    assert.equal(billing.promotionDiscount, "$20");
    assert.equal(billing.boxSubtotal, "$230");
  });

  it("applies buy 2 get third free", () => {
    const billing = computeInvoiceBilling({
      boxCount: 3,
      boxUnitPrice: "$50",
      catalogKey: "box|large",
      promotions: [thirdFreePromo],
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(billing.promotionDiscount, "$50");
    assert.equal(billing.boxSubtotal, "$100");
  });

  it("applies fourth box percentage discount", () => {
    const billing = computeInvoiceBilling({
      boxCount: 4,
      boxUnitPrice: "$80",
      catalogKey: "box|large",
      promotions: [fourthHalfPromo],
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(billing.promotionDiscount, "$40");
    assert.equal(billing.boxSubtotal, "$280");
  });

  it("requires seller choice when multiple promotions match", () => {
    const billing = computeInvoiceBilling({
      boxCount: 3,
      boxUnitPrice: "$50",
      catalogKey: "box|large",
      promotions: [bundlePromo, thirdFreePromo],
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(billing.promotionCandidates.length, 2);
    assert.equal(billing.promotionSelectionRequired, true);
    assert.equal(billing.promotionDiscount, "$0");

    const chosen = computeInvoiceBilling({
      boxCount: 3,
      boxUnitPrice: "$50",
      catalogKey: "box|large",
      promotions: [bundlePromo, thirdFreePromo],
      selectedPromotionId: "promo-free",
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(chosen.promotionSelectionRequired, false);
    assert.equal(chosen.promotion?.name, "Tercera gratis");
    assert.equal(chosen.boxSubtotal, "$100");
  });

  it("applies mixed cart promotions", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$0",
      cartLines: [
        { label: "X", catalogKey: "box|x", quantity: 1, unitPrice: "$100" },
        { label: "Y", catalogKey: "box|y", quantity: 1, unitPrice: "$200" },
      ],
      promotions: [mixedBundlePromo],
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    assert.equal(billing.boxSubtotalBeforeDiscount, "$300");
    assert.equal(billing.promotionDiscount, "$50");
    assert.equal(billing.boxSubtotal, "$250");
    assert.equal(billing.cartLines.length, 2);
  });

  it("reads old invoices without promotion fields", () => {
    const billing = readBillingFromPlan({
      billing: {
        boxCount: 2,
        boxUnitPrice: "$50",
        boxSubtotal: "$100",
        quotedTotal: "$100",
        minimumDeposit: "$20",
        payNow: "$20",
        balanceDue: "$80",
      },
    });

    assert.equal(billing?.boxSubtotalBeforeDiscount, "$100");
    assert.equal(billing?.promotionDiscount, "$0");
    assert.equal(billing?.promotion, null);
    assert.equal(billing?.depositRequired, "$20");
    assert.equal(billing?.depositStatus, "paid");
  });

  it("records pending and full payments without changing the quote", () => {
    const billing = computeInvoiceBilling({
      boxUnitPrice: "$100",
      emptyBoxDriver: false,
      fullBoxDriver: false,
      fees,
    });

    const pending = billingWithRecordedPayment(billing, "$0");
    const paid = billingWithRecordedPayment(billing, "$100");

    assert.equal(pending.balanceDue, "$100");
    assert.equal(pending.depositRequired, "$20");
    assert.equal(pending.depositStatus, "pending");
    assert.equal(paid.balanceDue, "$0");
    assert.equal(paid.depositRequired, "$20");
    assert.equal(paid.depositStatus, "paid");
    assert.deepEqual(invoiceAccountingStateForPayment(billing, "$0"), { invoiceStatus: "open", accountingStatus: "not_exportable" });
    assert.deepEqual(invoiceAccountingStateForPayment(billing, "$100"), { invoiceStatus: "paid", accountingStatus: "exportable" });
  });

  it("classifies later money as deposit until the required deposit is covered", () => {
    assert.equal(
      invoicePaymentKindForCurrentDeposit({ depositRequired: "$25", alreadyPaid: "$0" }),
      "deposit",
    );
    assert.equal(
      invoicePaymentKindForCurrentDeposit({ depositRequired: "$25", alreadyPaid: "$10" }),
      "deposit",
    );
    assert.equal(
      invoicePaymentKindForCurrentDeposit({ depositRequired: "$25", alreadyPaid: "$25" }),
      "balance",
    );
  });

  it("reads the latest driver collection outcome from the billing plan", () => {
    const billing = readBillingFromPlan({
      billing: {
        quotedTotal: "$100",
        payNow: "$20",
        lastDriverCollection: {
          expectedAmount: 80,
          receivedAmount: 0,
          outcome: "not_collected",
          collectedAt: "2026-07-13T10:00:00.000Z",
          totalBefore: 100,
          totalAfter: 100,
        },
      },
    });

    assert.deepEqual(billing?.lastDriverCollection, {
      expectedAmount: 80,
      receivedAmount: 0,
      outcome: "not_collected",
      collectedAt: "2026-07-13T10:00:00.000Z",
      totalBefore: 100,
      totalAfter: 100,
    });
  });
});

describe("saleFinishActionLabel", () => {
  const withBalance = { balanceDue: "$50" };
  const paidInFull = { balanceDue: "$0" };

  it("uses setup labels before opening the payment dialog", () => {
    assert.equal(saleFinishActionLabel(withBalance, { phase: "setup" }), "Configurar pago");
    assert.equal(saleFinishActionLabel(paidInFull, { phase: "setup" }), "Confirmar cierre");
  });

  it("uses confirm labels inside the payment dialog", () => {
    assert.equal(saleFinishActionLabel(withBalance), "Crear invoice");
    assert.equal(saleFinishActionLabel(paidInFull), "Cerrar venta");
  });
});
