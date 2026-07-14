"use server";

import { requireAppSession } from "@/lib/auth/session";
import { isClientOrganization } from "@/lib/organizations/kind";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { configPricesCountryHref } from "@/lib/country-options";
import {
  isOnboardingTutorialEnabled,
  onboardingTutorialDisabledProgress,
} from "@/lib/onboarding/feature";

export type OnboardingStepId =
  | "countries"
  | "inventory"
  | "pricing"
  | "stock"
  | "first_sale";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  completed: boolean;
};

export type OnboardingProgress = {
  eligible: boolean;
  dismissed: boolean;
  started: boolean;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  allComplete: boolean;
  inventoryHasCategory: boolean;
  inventoryHasItems: boolean;
  firstCountryName: string | null;
};

function isPositivePrice(price: string | null | undefined) {
  if (!price?.trim()) {
    return false;
  }

  const numeric = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0;
}

function buildSteps(input: {
  hasCountries: boolean;
  hasInventoryCategory: boolean;
  hasInventoryItems: boolean;
  hasPricedProducts: boolean;
  hasStock: boolean;
  hasFirstSale: boolean;
  firstCountryName: string | null;
  }): OnboardingStep[] {
  return [
    {
      id: "inventory",
      title: "Inventario",
      description: "Crea categorías y productos en el catálogo (cajas, tamaños).",
      href: "/inventario",
      completed: input.hasInventoryCategory && input.hasInventoryItems,
    },
    {
      id: "countries",
      title: "Países destino",
      description: "Agrega los países adonde envías (ej. México, Colombia).",
      href: "/configuracion?view=prices",
      completed: input.hasCountries,
    },
    {
      id: "pricing",
      title: "Precios por país",
      description: "Vincula productos a cada país y asigna su precio de venta.",
      href: configPricesCountryHref(input.firstCountryName || undefined),
      completed: input.hasPricedProducts,
    },
    {
      id: "stock",
      title: "Stock inicial",
      description: "Registra cuántas unidades de cada producto hay en bodega.",
      href: "/inventario",
      completed: input.hasStock,
    },
    {
      id: "first_sale",
      title: "Primera venta",
      description: "Crea remitente y destinatario, elige producto y cobra el envío.",
      href: "/venta",
      completed: input.hasFirstSale,
    },
  ];
}

export async function getOnboardingProgressAction(): Promise<ActionResult<OnboardingProgress>> {
  try {
    const session = await requireAppSession();

    if (!isOnboardingTutorialEnabled()) {
      return ok(onboardingTutorialDisabledProgress());
    }

    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const orgId = session.organizationId;

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("kind, settings")
      .eq("id", orgId)
      .single();

    if (orgError) {
      return fail(orgError.message);
    }

    const eligible = isClientOrganization(org?.kind);

    if (!eligible) {
      return ok({
        eligible: false,
        dismissed: false,
        started: false,
        steps: [],
        completedCount: 0,
        totalCount: 5,
        pendingCount: 0,
        allComplete: false,
        inventoryHasCategory: false,
        inventoryHasItems: false,
        firstCountryName: null,
      });
    }

    const settings = (org?.settings || {}) as OrganizationSettings;
    const dismissed = Boolean(settings.onboarding_dismissed);
    const started = Boolean(settings.onboarding_started);

    const [
      countriesResult,
      categoriesResult,
      inventoryItemsResult,
      pricedBoxesResult,
      stockResult,
      shipmentsResult,
    ] = await Promise.all([
      supabase
        .from("pricing_countries")
        .select("name", { count: "exact" })
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1),
      supabase
        .from("inventory_categories")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("pricing_country_boxes")
        .select("price")
        .eq("organization_id", orgId)
        .limit(40),
      supabase
        .from("inventory_stock")
        .select("stock")
        .eq("organization_id", orgId)
        .gt("stock", 0)
        .limit(1),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
    ]);

    if (countriesResult.error) {
      return fail(countriesResult.error.message);
    }

    if (categoriesResult.error) {
      return fail(categoriesResult.error.message);
    }

    if (inventoryItemsResult.error) {
      return fail(inventoryItemsResult.error.message);
    }

    if (pricedBoxesResult.error) {
      return fail(pricedBoxesResult.error.message);
    }

    if (stockResult.error) {
      return fail(stockResult.error.message);
    }

    if (shipmentsResult.error) {
      return fail(shipmentsResult.error.message);
    }

    const hasCountries = (countriesResult.count || 0) > 0;
    const firstCountryName = countriesResult.data?.[0]?.name || null;
    const hasInventoryCategory = (categoriesResult.count || 0) > 0;
    // La estructura de una categoría (tree_data) puede contener grupos vacíos.
    // Solo un registro real en inventory_items debe completar este paso.
    const hasInventoryItems = (inventoryItemsResult.count || 0) > 0;
    const hasPricedProducts = (pricedBoxesResult.data || []).some((row) =>
      isPositivePrice(row.price),
    );
    const hasStock = (stockResult.data || []).length > 0;
    // Crear un remitente o destinatario no es una venta. Este paso solo debe
    // completarse cuando exista al menos un envío/factura registrado.
    const hasFirstSale = (shipmentsResult.count || 0) > 0;

    const steps = buildSteps({
      hasCountries,
      hasInventoryCategory,
      hasInventoryItems,
      hasPricedProducts,
      hasStock,
      hasFirstSale,
      firstCountryName,
    });

    const completedCount = steps.filter((step) => step.completed).length;
    const pendingCount = steps.length - completedCount;

    return ok({
      eligible: true,
      dismissed,
      started,
      steps,
      completedCount,
      totalCount: steps.length,
      pendingCount,
      allComplete: completedCount === steps.length,
      inventoryHasCategory: hasInventoryCategory,
      inventoryHasItems: hasInventoryItems,
      firstCountryName,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
export async function setOnboardingStartedAction(): Promise<ActionResult<{ started: boolean }>> {
  try {
    const session = await requireAppSession();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", session.organizationId)
      .single();

    if (orgError) {
      return fail(orgError.message);
    }

    const nextSettings = {
      ...((org?.settings || {}) as OrganizationSettings),
      onboarding_started: true,
    };

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ settings: nextSettings })
      .eq("id", session.organizationId);

    if (updateError) {
      return fail(updateError.message);
    }

    return ok({ started: true });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
