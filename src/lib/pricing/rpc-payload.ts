import { parseMoneyValue } from "@/lib/logistics-fees";
import { isPromotionRuleValid, primaryCatalogKey } from "@/lib/combo-rules";
import { syncLinkedRouteSchedules } from "@/lib/pricing/load-config";
import type { PricingConfigPayload } from "@/lib/pricing/types";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";

function safePositiveInt(value: number, fallback: number) {
  return Math.max(Number.isFinite(value) ? Math.floor(value) : fallback, 1);
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

function legacyPromotionFields(rule: PricingPromotionConfig["rule"]) {
  const buyLine = rule.buy[0];
  const getLine = rule.get[0];

  if (rule.mode === "bundle_price") {
    return {
      promotion_type: "combo",
      bundle_quantity: buyLine?.quantity || 2,
      bundle_price: rule.bundlePrice || "$0",
      paid_quantity: buyLine?.quantity || 2,
      discounted_quantity: 1,
      discount_percent: 100,
    };
  }

  if (getLine?.kind === "set_total") {
    return {
      promotion_type: "combo",
      bundle_quantity: buyLine?.quantity || 2,
      bundle_price: getLine.amount || "$0",
      paid_quantity: buyLine?.quantity || 2,
      discounted_quantity: getLine.quantity || 1,
      discount_percent: 100,
    };
  }

  return {
    promotion_type: "combo",
    bundle_quantity: buyLine?.quantity || 2,
    bundle_price: getLine?.amount || "$0",
    paid_quantity: buyLine?.quantity || 2,
    discounted_quantity: getLine?.quantity || 1,
    discount_percent: getLine?.percent ?? 100,
  };
}

function assertNonNegativePrice(label: string, value: string) {
  const parsed = parseMoneyValue(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} invalido`);
  }
}

export function validatePricingConfigPayload(payload: PricingConfigPayload) {
  for (const country of payload.countries) {
    if (!country.name.trim() || !country.code.trim()) {
      throw new Error("Pais invalido");
    }

    for (const box of country.boxes) {
      if (!box.size.trim()) {
        throw new Error("Tamano de caja invalido");
      }
      assertNonNegativePrice("Precio", box.price);
      if (box.cost) {
        assertNonNegativePrice("Costo", box.cost);
      }
    }
  }

  for (const promotion of payload.promotions) {
    const catalogKey = primaryCatalogKey(promotion.rule) || promotion.catalogKey.trim();
    if (!promotion.countryName.trim() || !promotion.name.trim() || !catalogKey) {
      throw new Error("Promocion invalida");
    }
    if (!isPromotionRuleValid(promotion.rule)) {
      throw new Error("Regla de promocion invalida");
    }
  }

  for (const distributor of payload.distributors) {
    if (!distributor.name.trim()) {
      throw new Error("Distribuidor invalido");
    }
  }

  for (const [distributorName, countriesMap] of Object.entries(payload.distributorPrices)) {
    if (!distributorName.trim()) {
      throw new Error("Distribuidor invalido");
    }

    for (const [countryName, boxes] of Object.entries(countriesMap)) {
      if (!countryName.trim()) {
        throw new Error("Pais de distribuidor invalido");
      }

      for (const box of boxes) {
        if (!box.size.trim()) {
          throw new Error("Tamano de caja invalido");
        }
        assertNonNegativePrice("Precio de distribuidor", box.price);
      }
    }
  }
}

export function buildPricingRpcPayload(payload: PricingConfigPayload) {
  validatePricingConfigPayload(payload);

  const routeConfig = syncLinkedRouteSchedules(payload.routeConfig);

  return {
    countries: payload.countries.map((country, index) => ({
      code: country.code.trim(),
      name: country.name.trim(),
      deliveryTime: country.deliveryTime,
      sortOrder: index,
      boxes: country.boxes.map((box) => ({
        size: box.size.trim(),
        price: box.price,
        cost: box.cost || "$0",
        catalogKey: box.catalogKey || "",
      })),
    })),
    promotions: payload.promotions
      .map((promotion, index) => {
        const catalogKey = primaryCatalogKey(promotion.rule) || promotion.catalogKey.trim();
        if (!promotion.countryName.trim() || !promotion.name.trim() || !catalogKey) {
          return null;
        }
        if (!isPromotionRuleValid(promotion.rule)) {
          return null;
        }

        const legacyFields = legacyPromotionFields(promotion.rule);

        return {
          countryName: promotion.countryName.trim(),
          catalogKey,
          name: promotion.name.trim(),
          active: promotion.active,
          promotionType: legacyFields.promotion_type,
          bundleQuantity: safePositiveInt(Number(legacyFields.bundle_quantity), 2),
          bundlePrice: legacyFields.bundle_price || "$0",
          paidQuantity: safePositiveInt(Number(legacyFields.paid_quantity), 2),
          discountedQuantity: safePositiveInt(Number(legacyFields.discounted_quantity), 1),
          discountPercent: safePercent(Number(legacyFields.discount_percent)),
          sortOrder: promotion.sortOrder ?? index,
          ruleJson: promotion.rule,
        };
      })
      .filter(Boolean),
    distributors: payload.distributors.map((distributor) => ({
      name: distributor.name.trim(),
      contact: distributor.contact,
      phone: distributor.phone,
      active: distributor.active,
    })),
    distributorPrices: payload.distributorPrices,
    routeConfig: {
      deliveryDays: routeConfig.deliveryDays,
      pickupDays: routeConfig.pickupDays,
      deliveryRanges: routeConfig.deliveryRanges,
      pickupRanges: routeConfig.pickupRanges,
      pendingAllowed: routeConfig.pendingAllowed,
      routeLeadTime: routeConfig.routeLeadTime,
      linkedRouteSchedules: routeConfig.linkedRouteSchedules,
      emptyBoxDeliveryFee: routeConfig.emptyBoxDeliveryFee,
      fullBoxPickupFee: routeConfig.fullBoxPickupFee,
      minimumDeposit: routeConfig.minimumDeposit,
      logisticsFeeMode: routeConfig.logisticsFeeMode,
    },
  };
}
