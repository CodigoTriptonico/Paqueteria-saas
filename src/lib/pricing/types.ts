import type { InventoryCatalogProduct } from "@/lib/pricing-catalog";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";

export type PricingBoxConfig = {
  size: string;
  price: string;
  cost?: string;
  catalogKey?: string;
};

export type PricingCountryConfig = {
  code: string;
  name: string;
  deliveryTime: string;
  boxes: PricingBoxConfig[];
};

export type PricingDistributorConfig = {
  name: string;
  contact: string;
  phone: string;
  active: boolean;
};

export type PricingDistributorPrices = Record<string, Record<string, PricingBoxConfig[]>>;

export type PricingRouteConfig = {
  deliveryDays: string[];
  pickupDays: string[];
  deliveryRanges: string[];
  pickupRanges: string[];
  pendingAllowed: boolean;
  routeLeadTime: string;
  linkedRouteSchedules: boolean;
  emptyBoxDeliveryFee: string;
  fullBoxPickupFee: string;
  minimumDeposit: string;
  logisticsFeeMode: "per_trip" | "per_box";
};

export type PricingConfigPayload = {
  countries: PricingCountryConfig[];
  promotions: PricingPromotionConfig[];
  distributors: PricingDistributorConfig[];
  distributorPrices: PricingDistributorPrices;
  routeConfig: PricingRouteConfig;
  catalogProducts: InventoryCatalogProduct[];
};
