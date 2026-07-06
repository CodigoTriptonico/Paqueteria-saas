"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { isClientOrganization } from "@/lib/organizations/kind";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
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

function treeDataHasItems(treeData: unknown) {
  return Array.isArray(treeData) && treeData.length > 0;
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
      id: "countries",
      title: "Países destino",
      description: "Configura los países adonde envías paquetes.",
      href: "/configuracion",
      completed: input.hasCountries,
    },
    {
      id: "inventory",
      title: "Inventario",
      description: "Crea categorías y los productos que vendes.",
      href: "/inventario",
      completed: input.hasInventoryCategory && input.hasInventoryItems,
    },
    {
      id: "pricing",
      title: "Precios por país",
      description: "Asigna el precio de venta de cada producto por destino.",
      href: "/configuracion",
      completed: input.hasPricedProducts,
    },
    {
      id: "stock",
      title: "Stock inicial",
      description: "Registra cuántas unidades tienes en bodega.",
      href: "/inventario",
      completed: input.hasStock,
    },
    {
      id: "first_sale",
      title: "Primera venta",
      description: "Registra un remitente, destinatario y cobra tu primer envío.",
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

    const [
      countriesResult,
      categoriesResult,
      inventoryItemsResult,
      pricedBoxesResult,
      stockResult,
      shipmentsResult,
      customersResult,
    ] = await Promise.all([
      supabase
        .from("pricing_countries")
        .select("name", { count: "exact" })
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1),
      supabase.from("inventory_categories").select("tree_data", { count: "exact" }).eq("organization_id", orgId),
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
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_active", true),
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

    if (customersResult.error) {
      return fail(customersResult.error.message);
    }

    const hasCountries = (countriesResult.count || 0) > 0;
    const firstCountryName = countriesResult.data?.[0]?.name || null;
    const hasInventoryCategory = (categoriesResult.count || 0) > 0;
    const hasInventoryItems =
      (inventoryItemsResult.count || 0) > 0 ||
      (categoriesResult.data || []).some((row) => treeDataHasItems(row.tree_data));
    const hasPricedProducts = (pricedBoxesResult.data || []).some((row) =>
      isPositivePrice(row.price),
    );
    const hasStock = (stockResult.data || []).length > 0;
    const hasFirstSale =
      (shipmentsResult.count || 0) > 0 || (customersResult.count || 0) > 0;

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

export async function setOnboardingDismissedAction(
  dismissed: boolean,
): Promise<ActionResult<{ dismissed: boolean }>> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "settings.manage")) {
      throw new Error("FORBIDDEN");
    }

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
      onboarding_dismissed: dismissed,
    };

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ settings: nextSettings })
      .eq("id", session.organizationId);

    if (updateError) {
      return fail(updateError.message);
    }

    return ok({ dismissed });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
