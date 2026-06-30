import { resolveCountryCode } from "@/lib/country-options";
import { categoriesToConfig, type DbCategory } from "@/lib/inventory-backend";
import type { CategoryConfig } from "@/lib/inventory-tree";
import { listCatalogProducts } from "@/lib/pricing-catalog";
import { defaultInvoiceBillingConfig } from "@/lib/invoice-billing";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";
import { promotionFromDbRow } from "@/lib/combo-rules";
import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PricingConfigPayload,
  PricingCountryConfig,
  PricingDistributorConfig,
  PricingDistributorPrices,
  PricingRouteConfig,
} from "@/lib/pricing/types";

export const emptyRouteConfig: PricingRouteConfig = {
  deliveryDays: [],
  pickupDays: [],
  deliveryRanges: [],
  pickupRanges: [],
  pendingAllowed: true,
  routeLeadTime: "",
  linkedRouteSchedules: false,
  emptyBoxDeliveryFee: defaultInvoiceBillingConfig.emptyBoxDeliveryFee,
  fullBoxPickupFee: defaultInvoiceBillingConfig.fullBoxPickupFee,
  minimumDeposit: defaultInvoiceBillingConfig.minimumDeposit,
  logisticsFeeMode: defaultInvoiceBillingConfig.logisticsFeeMode,
};

type DbPricingCountryBox = {
  size: string;
  price: string;
  cost: string | null;
  catalog_key?: string | null;
};

type DbPricingPromotion = {
  id: string;
  catalog_key: string;
  name: string;
  is_active: boolean;
  promotion_type: string;
  bundle_quantity: number | null;
  bundle_price: string | null;
  paid_quantity: number | null;
  discounted_quantity: number | null;
  discount_percent: number | string | null;
  sort_order?: number | null;
  rule_json?: unknown;
  pricing_countries?: { name: string } | { name: string }[] | null;
};

function syncLinkedRouteSchedules(config: PricingRouteConfig): PricingRouteConfig {
  if (!config.linkedRouteSchedules) {
    return config;
  }

  return {
    ...config,
    pickupDays: [...config.deliveryDays],
    pickupRanges: [...config.deliveryRanges],
  };
}

export function canReadPricingSession(session: AppSession) {
  return (
    sessionHasPermission(session, "settings.manage") ||
    sessionHasPermission(session, "sales.manage")
  );
}

export function canWritePricingSession(session: AppSession) {
  return sessionHasPermission(session, "settings.manage");
}

function relatedCountryName(country: DbPricingPromotion["pricing_countries"]) {
  if (Array.isArray(country)) {
    return country[0]?.name || "";
  }

  return country?.name || "";
}

const PROMOTIONS_SELECT_WITH_RULE =
  "id, catalog_key, name, is_active, promotion_type, bundle_quantity, bundle_price, paid_quantity, discounted_quantity, discount_percent, rule_json, sort_order, pricing_countries(name)";

const PROMOTIONS_SELECT_LEGACY =
  "id, catalog_key, name, is_active, promotion_type, bundle_quantity, bundle_price, paid_quantity, discounted_quantity, discount_percent, sort_order, pricing_countries(name)";

function isMissingRuleJsonColumn(message?: string | null) {
  return Boolean(message && /rule_json/i.test(message) && /does not exist|column/i.test(message));
}

async function loadPricingPromotions(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  orgId: string,
) {
  const withRule = await supabase
    .from("pricing_promotions")
    .select(PROMOTIONS_SELECT_WITH_RULE)
    .eq("organization_id", orgId)
    .order("sort_order");

  if (!withRule.error || !isMissingRuleJsonColumn(withRule.error.message)) {
    return withRule;
  }

  return supabase
    .from("pricing_promotions")
    .select(PROMOTIONS_SELECT_LEGACY)
    .eq("organization_id", orgId)
    .order("sort_order");
}

async function loadInventoryCategoryConfigs(
  supabase: SupabaseClient,
  orgId: string,
): Promise<CategoryConfig[]> {
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("id, name, tree_data")
    .eq("organization_id", orgId)
    .order("name");

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  return categoriesToConfig((data || []) as DbCategory[]);
}

export async function loadPricingConfigForSession(
  session: AppSession,
): Promise<PricingConfigPayload> {
  if (!canReadPricingSession(session)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }

  const orgId = session.organizationId;

  const [
    countriesResult,
    promotionsQuery,
    distributorsResult,
    distributorBoxesResult,
    routeResult,
    categoryConfigs,
  ] = await Promise.all([
    supabase
      .from("pricing_countries")
      .select(
        "id, code, name, delivery_time, sort_order, pricing_country_boxes(size, price, cost, catalog_key)",
      )
      .eq("organization_id", orgId)
      .order("sort_order")
      .order("name"),
    loadPricingPromotions(supabase, orgId),
    supabase
      .from("distributors")
      .select("id, name, contact, phone, is_active")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("distributor_country_boxes")
      .select("size, price, distributor_id, country_id, distributors(name), pricing_countries(name)")
      .eq("organization_id", orgId),
    supabase
      .from("organization_route_settings")
      .select(
        "delivery_days, pickup_days, delivery_ranges, pickup_ranges, pending_allowed, route_lead_time, linked_route_schedules, empty_box_delivery_fee, full_box_pickup_fee, minimum_deposit, logistics_fee_mode",
      )
      .eq("organization_id", orgId)
      .maybeSingle(),
    loadInventoryCategoryConfigs(supabase, orgId),
  ]);

  const catalogProducts = listCatalogProducts(categoryConfigs);

  if (countriesResult.error?.code === "42P01") {
    return {
      countries: [],
      promotions: [],
      distributors: [],
      distributorPrices: {},
      routeConfig: emptyRouteConfig,
      catalogProducts,
    };
  }

  if (countriesResult.error) {
    throw new Error(countriesResult.error.message);
  }

  if (distributorsResult.error) {
    throw new Error(distributorsResult.error.message);
  }

  if (promotionsQuery.error && promotionsQuery.error.code !== "42P01") {
    throw new Error(promotionsQuery.error.message);
  }

  const countries: PricingCountryConfig[] = (countriesResult.data || []).map((row) => {
    const boxes = (row.pricing_country_boxes as DbPricingCountryBox[] | null) || [];

    return {
      code: resolveCountryCode({ code: row.code || "", name: row.name }),
      name: row.name,
      deliveryTime: row.delivery_time || "",
      boxes: boxes.map((box) => ({
        size: box.size,
        price: box.price,
        cost: box.cost || "$0",
        catalogKey: box.catalog_key || undefined,
      })),
    };
  });

  const distributors: PricingDistributorConfig[] = (distributorsResult.data || []).map(
    (row) => ({
      name: row.name,
      contact: row.contact,
      phone: row.phone,
      active: row.is_active,
    }),
  );

  const promotions: PricingPromotionConfig[] =
    promotionsQuery.error?.code === "42P01"
      ? []
      : ((promotionsQuery.data || []) as DbPricingPromotion[])
          .map((row) => {
            const countryName = relatedCountryName(row.pricing_countries);

            if (!countryName) {
              return null;
            }

            return promotionFromDbRow({
              id: row.id,
              countryName,
              name: row.name,
              active: row.is_active,
              catalog_key: row.catalog_key,
              sort_order: row.sort_order ?? undefined,
              rule_json: row.rule_json,
              legacy: row,
            });
          })
          .filter((promotion): promotion is PricingPromotionConfig => Boolean(promotion));

  const distributorPrices: PricingDistributorPrices = {};

  for (const row of distributorBoxesResult.data || []) {
    const distributor = row.distributors as { name: string } | { name: string }[] | null;
    const country = row.pricing_countries as { name: string } | { name: string }[] | null;
    const distributorName = Array.isArray(distributor) ? distributor[0]?.name : distributor?.name;
    const countryName = Array.isArray(country) ? country[0]?.name : country?.name;

    if (!distributorName || !countryName) {
      continue;
    }

    if (!distributorPrices[distributorName]) {
      distributorPrices[distributorName] = {};
    }

    if (!distributorPrices[distributorName][countryName]) {
      distributorPrices[distributorName][countryName] = [];
    }

    distributorPrices[distributorName][countryName].push({
      size: row.size,
      price: row.price,
    });
  }

  const routeRow = routeResult.data;

  const routeConfig: PricingRouteConfig = syncLinkedRouteSchedules(
    routeRow
      ? {
          deliveryDays: routeRow.delivery_days || [],
          pickupDays: routeRow.pickup_days || [],
          deliveryRanges: routeRow.delivery_ranges || [],
          pickupRanges: routeRow.pickup_ranges || [],
          pendingAllowed: routeRow.pending_allowed,
          routeLeadTime: routeRow.route_lead_time || "",
          linkedRouteSchedules: routeRow.linked_route_schedules ?? false,
          emptyBoxDeliveryFee: defaultInvoiceBillingConfig.emptyBoxDeliveryFee,
          fullBoxPickupFee: defaultInvoiceBillingConfig.fullBoxPickupFee,
          minimumDeposit: routeRow.minimum_deposit || defaultInvoiceBillingConfig.minimumDeposit,
          logisticsFeeMode: defaultInvoiceBillingConfig.logisticsFeeMode,
        }
      : emptyRouteConfig,
  );

  return {
    countries,
    promotions,
    distributors,
    distributorPrices,
    routeConfig,
    catalogProducts,
  };
}

export async function promotionsRuleJsonColumnAvailable(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
) {
  const { error } = await supabase.from("pricing_promotions").select("id, rule_json").limit(1);

  if (error?.code === "42P01") {
    return false;
  }

  if (error && isMissingRuleJsonColumn(error.message)) {
    return false;
  }

  return true;
}

export { isMissingRuleJsonColumn, syncLinkedRouteSchedules };
