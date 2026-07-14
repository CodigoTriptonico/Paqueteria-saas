import { defaultInvoiceBillingConfig } from "@/lib/invoice-billing";
import { parseMoneyValue } from "@/lib/logistics-fees";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";
import type { PricingCountryConfig, PricingRouteConfig } from "@/lib/pricing/types";

export type SaleLogisticsFeesPayload = Pick<
  PricingRouteConfig,
  "emptyBoxDeliveryFee" | "fullBoxPickupFee" | "minimumDeposit" | "logisticsFeeMode"
>;

export function saleCountryBoxesFromCountries(countries: PricingCountryConfig[]) {
  const countryBoxes: Record<string, string[][]> = {};

  for (const country of countries) {
    const pricedBoxes = country.boxes.filter(
      (box) => parseMoneyValue(box.price || "$0") > 0,
    );

    countryBoxes[country.name] = pricedBoxes.map((box) => [
      box.size,
      box.price,
      box.cost || "$0",
      "",
      country.deliveryTime || "",
      box.catalogKey || box.size,
    ]);
  }

  return countryBoxes;
}

export function salePricingFromConfig(countries: PricingCountryConfig[], promotions: PricingPromotionConfig[]) {
  return {
    countryBoxes: saleCountryBoxesFromCountries(countries),
    promotions: promotions.filter((promotion) => promotion.active),
  };
}

export function saleLogisticsFeesFromRouteConfig(routeConfig: PricingRouteConfig): SaleLogisticsFeesPayload {
  return {
    emptyBoxDeliveryFee: defaultInvoiceBillingConfig.emptyBoxDeliveryFee,
    fullBoxPickupFee: defaultInvoiceBillingConfig.fullBoxPickupFee,
    minimumDeposit: routeConfig.minimumDeposit,
    logisticsFeeMode: defaultInvoiceBillingConfig.logisticsFeeMode,
  };
}
