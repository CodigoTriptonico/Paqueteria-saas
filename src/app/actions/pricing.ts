"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";

export type PricingBoxConfig = {
  size: string;
  price: string;
  cost?: string;
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
};

export type PricingConfigPayload = {
  countries: PricingCountryConfig[];
  distributors: PricingDistributorConfig[];
  distributorPrices: PricingDistributorPrices;
  routeConfig: PricingRouteConfig;
};

const emptyRouteConfig: PricingRouteConfig = {
  deliveryDays: [],
  pickupDays: [],
  deliveryRanges: [],
  pickupRanges: [],
  pendingAllowed: true,
  routeLeadTime: "",
};

function canReadPricing(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "settings.manage") ||
    sessionHasPermission(session, "sales.manage")
  );
}

function canWritePricing(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return sessionHasPermission(session, "settings.manage");
}

export async function loadPricingConfigAction(): Promise<ActionResult<PricingConfigPayload>> {
  try {
    const session = await requireAppSession();

    if (!canReadPricing(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const orgId = session.organizationId;

    const [countriesResult, distributorsResult, distributorBoxesResult, routeResult] =
      await Promise.all([
        supabase
          .from("pricing_countries")
          .select("id, code, name, delivery_time, sort_order, pricing_country_boxes(size, price, cost)")
          .eq("organization_id", orgId)
          .order("sort_order")
          .order("name"),
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
            "delivery_days, pickup_days, delivery_ranges, pickup_ranges, pending_allowed, route_lead_time",
          )
          .eq("organization_id", orgId)
          .maybeSingle(),
      ]);

    if (countriesResult.error?.code === "42P01") {
      return ok({
        countries: [],
        distributors: [],
        distributorPrices: {},
        routeConfig: emptyRouteConfig,
      });
    }

    if (countriesResult.error) {
      return fail(countriesResult.error.message);
    }

    if (distributorsResult.error) {
      return fail(distributorsResult.error.message);
    }

    const countries: PricingCountryConfig[] = (countriesResult.data || []).map((row) => {
      const boxes = (row.pricing_country_boxes as PricingBoxConfig[] | null) || [];

      return {
        code: row.code,
        name: row.name,
        deliveryTime: row.delivery_time || "",
        boxes: boxes.map((box) => ({
          size: box.size,
          price: box.price,
          cost: box.cost || "$0",
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

    const routeConfig: PricingRouteConfig = routeRow
      ? {
          deliveryDays: routeRow.delivery_days || [],
          pickupDays: routeRow.pickup_days || [],
          deliveryRanges: routeRow.delivery_ranges || [],
          pickupRanges: routeRow.pickup_ranges || [],
          pendingAllowed: routeRow.pending_allowed,
          routeLeadTime: routeRow.route_lead_time || "",
        }
      : emptyRouteConfig;

    return ok({ countries, distributors, distributorPrices, routeConfig });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function savePricingConfigAction(
  payload: PricingConfigPayload,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canWritePricing(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const orgId = session.organizationId;

    await supabase.from("distributor_country_boxes").delete().eq("organization_id", orgId);
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
          })),
        );

        if (boxesError) {
          return fail(boxesError.message);
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

    const { error: routeError } = await supabase.from("organization_route_settings").upsert({
      organization_id: orgId,
      delivery_days: payload.routeConfig.deliveryDays,
      pickup_days: payload.routeConfig.pickupDays,
      delivery_ranges: payload.routeConfig.deliveryRanges,
      pickup_ranges: payload.routeConfig.pickupRanges,
      pending_allowed: payload.routeConfig.pendingAllowed,
      route_lead_time: payload.routeConfig.routeLeadTime,
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

/** Cajas por pais para el flujo de venta: [tamano, precio, costo, carrier, tiempo] */
export async function loadSaleCountryBoxesAction(): Promise<
  ActionResult<Record<string, string[][]>>
> {
  try {
    const session = await requireAppSession();

    if (!canReadPricing(session)) {
      throw new Error("FORBIDDEN");
    }

    const result = await loadPricingConfigAction();

    if (!result.ok) {
      return result;
    }

    const countryBoxes: Record<string, string[][]> = {};

    for (const country of result.data.countries) {
      countryBoxes[country.name] = country.boxes.map((box) => [
        box.size,
        box.price,
        box.cost || "$0",
        "",
        country.deliveryTime || "",
      ]);
    }

    return ok(countryBoxes);
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
