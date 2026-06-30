"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { defaultInvoiceBillingConfig } from "@/lib/invoice-billing";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";
import {
  isPromotionRuleValid,
  primaryCatalogKey,
} from "@/lib/combo-rules";
import {
  canReadPricingSession,
  canWritePricingSession,
  isMissingRuleJsonColumn,
  loadPricingConfigForSession,
  promotionsRuleJsonColumnAvailable,
  syncLinkedRouteSchedules,
} from "@/lib/pricing/load-config";
import {
  saleCountryBoxesFromCountries,
  saleLogisticsFeesFromRouteConfig,
  salePricingFromConfig,
} from "@/lib/pricing/sale-derivatives";
import type { SaleLogisticsFeesPayload, SalePricingPayload } from "@/lib/pricing/sale-derivatives";
import type { PricingConfigPayload } from "@/lib/pricing/types";

export type {
  PricingBoxConfig,
  PricingConfigPayload,
  PricingCountryConfig,
  PricingDistributorConfig,
  PricingDistributorPrices,
  PricingRouteConfig,
} from "@/lib/pricing/types";
export type { SaleLogisticsFeesPayload, SalePricingPayload } from "@/lib/pricing/sale-derivatives";

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

function safePositiveInt(value: number, fallback: number) {
  return Math.max(Number.isFinite(value) ? Math.floor(value) : fallback, 1);
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

export async function loadPricingConfigAction(): Promise<ActionResult<PricingConfigPayload>> {
  try {
    const session = await requireAppSession();
    const data = await loadPricingConfigForSession(session);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function savePricingConfigAction(
  payload: PricingConfigPayload,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canWritePricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const orgId = session.organizationId;

    await supabase.from("distributor_country_boxes").delete().eq("organization_id", orgId);
    const promotionsDeleteResult = await supabase
      .from("pricing_promotions")
      .delete()
      .eq("organization_id", orgId);
    const promotionsTableAvailable = promotionsDeleteResult.error?.code !== "42P01";

    if (promotionsDeleteResult.error && promotionsTableAvailable) {
      return fail(promotionsDeleteResult.error.message);
    }

    await supabase.from("pricing_country_boxes").delete().eq("organization_id", orgId);
    await supabase.from("distributors").delete().eq("organization_id", orgId);
    await supabase.from("pricing_countries").delete().eq("organization_id", orgId);

    const countryIdByName = new Map<string, string>();

    for (const [index, country] of payload.countries.entries()) {
      const { data: insertedCountry, error: countryError } = await supabase
        .from("pricing_countries")
        .insert({
          organization_id: orgId,
          code: country.code,
          name: country.name,
          delivery_time: country.deliveryTime,
          sort_order: index,
        })
        .select("id, name")
        .single();

      if (countryError || !insertedCountry) {
        return fail(countryError?.message || "No se pudo guardar paises");
      }

      countryIdByName.set(country.name, insertedCountry.id);

      if (country.boxes.length) {
        const { error: boxesError } = await supabase.from("pricing_country_boxes").insert(
          country.boxes.map((box) => ({
            organization_id: orgId,
            country_id: insertedCountry.id,
            size: box.size,
            price: box.price,
            cost: box.cost || "$0",
            catalog_key: box.catalogKey || null,
          })),
        );

        if (boxesError) {
          return fail(boxesError.message);
        }
      }
    }

    if (promotionsTableAvailable && payload.promotions.length) {
      const promotionsRuleJsonAvailable = await promotionsRuleJsonColumnAvailable(supabase);

      const promotionRows = payload.promotions
        .map((promotion) => {
          const countryId = countryIdByName.get(promotion.countryName);

          const catalogKey =
            primaryCatalogKey(promotion.rule) || promotion.catalogKey.trim();

          if (!countryId || !promotion.name.trim() || !catalogKey || !isPromotionRuleValid(promotion.rule)) {
            return null;
          }

          const legacyFields = legacyPromotionFields(promotion.rule);

          const row: Record<string, unknown> = {
            organization_id: orgId,
            country_id: countryId,
            catalog_key: catalogKey,
            name: promotion.name.trim(),
            is_active: promotion.active,
            promotion_type: legacyFields.promotion_type,
            bundle_quantity: safePositiveInt(Number(legacyFields.bundle_quantity), 2),
            bundle_price: legacyFields.bundle_price || "$0",
            paid_quantity: safePositiveInt(Number(legacyFields.paid_quantity), 2),
            discounted_quantity: safePositiveInt(Number(legacyFields.discounted_quantity), 1),
            discount_percent: safePercent(Number(legacyFields.discount_percent)),
            sort_order: promotion.sortOrder,
          };

          if (promotionsRuleJsonAvailable) {
            row.rule_json = promotion.rule;
          }

          return row;
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      if (promotionRows.length) {
        let { error: promotionsError } = await supabase
          .from("pricing_promotions")
          .insert(promotionRows);

        if (promotionsError && isMissingRuleJsonColumn(promotionsError.message)) {
          const legacyRows = promotionRows.map((row) => {
            const legacyRow = { ...row };
            delete legacyRow.rule_json;
            return legacyRow;
          });

          ({ error: promotionsError } = await supabase
            .from("pricing_promotions")
            .insert(legacyRows));
        }

        if (promotionsError) {
          return fail(promotionsError.message);
        }
      }
    }

    const distributorIdByName = new Map<string, string>();

    for (const distributor of payload.distributors) {
      const { data: insertedDistributor, error: distributorError } = await supabase
        .from("distributors")
        .insert({
          organization_id: orgId,
          name: distributor.name,
          contact: distributor.contact,
          phone: distributor.phone,
          is_active: distributor.active,
        })
        .select("id, name")
        .single();

      if (distributorError || !insertedDistributor) {
        return fail(distributorError?.message || "No se pudo guardar distribuidores");
      }

      distributorIdByName.set(distributor.name, insertedDistributor.id);
    }

    const distributorBoxRows: {
      organization_id: string;
      distributor_id: string;
      country_id: string;
      size: string;
      price: string;
    }[] = [];

    for (const [distributorName, countriesMap] of Object.entries(payload.distributorPrices)) {
      const distributorId = distributorIdByName.get(distributorName);

      if (!distributorId) {
        continue;
      }

      for (const [countryName, boxes] of Object.entries(countriesMap)) {
        const countryId = countryIdByName.get(countryName);

        if (!countryId) {
          continue;
        }

        for (const box of boxes) {
          distributorBoxRows.push({
            organization_id: orgId,
            distributor_id: distributorId,
            country_id: countryId,
            size: box.size,
            price: box.price,
          });
        }
      }
    }

    if (distributorBoxRows.length) {
      const { error: distributorBoxesError } = await supabase
        .from("distributor_country_boxes")
        .insert(distributorBoxRows);

      if (distributorBoxesError) {
        return fail(distributorBoxesError.message);
      }
    }

    const routeConfig = syncLinkedRouteSchedules(payload.routeConfig);

    const { error: routeError } = await supabase.from("organization_route_settings").upsert({
      organization_id: orgId,
      delivery_days: routeConfig.deliveryDays,
      pickup_days: routeConfig.pickupDays,
      delivery_ranges: routeConfig.deliveryRanges,
      pickup_ranges: routeConfig.pickupRanges,
      pending_allowed: routeConfig.pendingAllowed,
      route_lead_time: routeConfig.routeLeadTime,
      linked_route_schedules: routeConfig.linkedRouteSchedules,
      empty_box_delivery_fee: defaultInvoiceBillingConfig.emptyBoxDeliveryFee,
      full_box_pickup_fee: defaultInvoiceBillingConfig.fullBoxPickupFee,
      minimum_deposit: routeConfig.minimumDeposit,
      logistics_fee_mode: defaultInvoiceBillingConfig.logisticsFeeMode,
      updated_at: new Date().toISOString(),
    });

    if (routeError) {
      return fail(routeError.message);
    }

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

/** Cajas por pais para venta: [tamano, precio, costo, carrier, tiempo, catalogKey] */
export async function loadSaleCountryBoxesAction(): Promise<
  ActionResult<Record<string, string[][]>>
> {
  try {
    const session = await requireAppSession();

    if (!canReadPricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const config = await loadPricingConfigForSession(session);
    return ok(saleCountryBoxesFromCountries(config.countries));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadSalePricingAction(): Promise<ActionResult<SalePricingPayload>> {
  try {
    const session = await requireAppSession();

    if (!canReadPricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const config = await loadPricingConfigForSession(session);
    return ok(salePricingFromConfig(config.countries, config.promotions));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function loadSaleLogisticsFeesAction(): Promise<
  ActionResult<SaleLogisticsFeesPayload>
> {
  try {
    const session = await requireAppSession();

    if (!canReadPricingSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const config = await loadPricingConfigForSession(session);
    return ok(saleLogisticsFeesFromRouteConfig(config.routeConfig));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function allocateInvoiceNumberAction(): Promise<ActionResult<{ invoiceNumber: string }>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "sales.manage")) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase.rpc("next_organization_invoice_number", {
      target_org_id: session.organizationId,
    });

    if (error) {
      return fail(error.message);
    }

    const sequence = Number(data) || 1;
    const invoiceNumber = `INV-${String(sequence).padStart(6, "0")}`;

    return ok({ invoiceNumber });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
