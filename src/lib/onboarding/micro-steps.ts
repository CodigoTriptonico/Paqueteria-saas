import type { OnboardingProgress, OnboardingStepId } from "@/app/actions/onboarding";
import { configPricesCountryHref } from "@/lib/country-options";

export type OnboardingChecklistItem = {
  label: string;
  done: boolean;
  current: boolean;
};

export type OnboardingMicroStepState = {
  stepId: OnboardingStepId;
  stepNumber: number;
  microStepIndex: number;
  microStepTotal: number;
  title: string;
  body: string;
  checklist: OnboardingChecklistItem[];
  actionHref?: string;
  actionLabel?: string;
};

type MicroStepDef = {
  label: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
};

const CONFIG_SECTIONS = new Set([
  "plan",
  "prices",
  "distributors",
  "inventory",
  "deliveries",
  "appearance",
  "company",
  "users",
]);

function parseConfigSection(searchParams: URLSearchParams) {
  const view = searchParams.get("view");
  return CONFIG_SECTIONS.has(view ?? "") ? view! : "menu";
}

function stepNumber(progress: OnboardingProgress, stepId: OnboardingStepId) {
  const index = progress.steps.findIndex((step) => step.id === stepId);
  return index >= 0 ? index + 1 : 0;
}

function currentIncompleteStep(progress: OnboardingProgress) {
  return progress.steps.find((step) => !step.completed) ?? null;
}

function buildGuide(
  stepId: OnboardingStepId,
  progress: OnboardingProgress,
  steps: MicroStepDef[],
  activeIndex: number,
): OnboardingMicroStepState {
  const current = steps[activeIndex];
  const checklist: OnboardingChecklistItem[] = steps.map((item, index) => ({
    label: item.label,
    done: index < activeIndex,
    current: index === activeIndex,
  }));

  return {
    stepId,
    stepNumber: stepNumber(progress, stepId),
    microStepIndex: activeIndex + 1,
    microStepTotal: steps.length,
    title: current.title,
    body: current.body,
    checklist,
    actionHref: current.actionHref,
    actionLabel: current.actionLabel,
  };
}

function resolveCountriesGuide(
  pathname: string,
  searchParams: URLSearchParams,
  progress: OnboardingProgress,
): OnboardingMicroStepState {
  const steps: MicroStepDef[] = [
    {
      label: "Ir a Configuración",
      title: "Abre Configuración",
      body: "En el menú lateral pulsa Configuración. Ahí está todo lo que debes preparar antes de vender.",
      actionHref: "/configuracion",
      actionLabel: "Ir a Configuración",
    },
    {
      label: "Abrir Países y precios",
      title: "Abre Países y precios",
      body: "En la cuadrícula de opciones pulsa la tarjeta Países y precios (icono de globo).",
      actionHref: "/configuracion?view=prices",
      actionLabel: "Abrir Países y precios",
    },
    {
      label: "Agregar un país",
      title: "Agrega un país destino",
      body: "Pulsa Agregar país, busca en la lista (ej. México o Colombia) y confírmalo.",
    },
  ];

  let activeIndex = 0;

  if (pathname.startsWith("/configuracion")) {
    const section = parseConfigSection(searchParams);
    if (section === "prices") {
      activeIndex = 2;
    } else {
      activeIndex = 1;
    }
  }

  return buildGuide("countries", progress, steps, activeIndex);
}

function resolveInventoryGuide(
  pathname: string,
  progress: OnboardingProgress,
): OnboardingMicroStepState {
  const steps: MicroStepDef[] = [
    {
      label: "Ir a Inventario",
      title: "Abre Inventario",
      body: "En el menú lateral pulsa Inventario. Ahí crearás categorías y productos.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
    {
      label: "Crear categoría",
      title: "Crea tu primera categoría",
      body: "En el panel izquierdo pulsa Agregar categoría y escribe un nombre simple, por ejemplo Cajas.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
    {
      label: "Agregar item",
      title: "Agrega tu primer item",
      body: "Elige la categoría y pulsa + Agregar item. Escribe un nombre como 14x14x14 o Mediana y confirma.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
  ];

  let activeIndex = 0;

  if (pathname.startsWith("/inventario")) {
    if (!progress.inventoryHasCategory) {
      activeIndex = 1;
    } else {
      activeIndex = 2;
    }
  }

  return buildGuide("inventory", progress, steps, activeIndex);
}

function resolvePricingGuide(
  pathname: string,
  searchParams: URLSearchParams,
  progress: OnboardingProgress,
): OnboardingMicroStepState {
  const countryHref = configPricesCountryHref(progress.firstCountryName || undefined);

  const steps: MicroStepDef[] = [
    {
      label: "Ir a Configuración",
      title: "Abre Configuración",
      body: "Los precios por país se configuran dentro de Configuración.",
      actionHref: "/configuracion",
      actionLabel: "Ir a Configuración",
    },
    {
      label: "Abrir Países y precios",
      title: "Abre Países y precios",
      body: "Pulsa la tarjeta Países y precios para ver tus destinos.",
      actionHref: "/configuracion?view=prices",
      actionLabel: "Abrir Países y precios",
    },
    {
      label: "Elegir país",
      title: "Selecciona un país",
      body: "En la lista pulsa el país al que quieres asignar precios de venta.",
      actionHref: "/configuracion?view=prices",
      actionLabel: "Ver países",
    },
    {
      label: "Asignar precios",
      title: "Pon precio a tus productos",
      body: "Busca cada caja o producto y escribe cuánto cuesta venderlo en ese destino.",
      actionHref: countryHref,
      actionLabel: "Ir a precios",
    },
  ];

  let activeIndex = 0;

  if (pathname.startsWith("/configuracion")) {
    const section = parseConfigSection(searchParams);
    const country = searchParams.get("country")?.trim();

    if (section === "prices" && country) {
      activeIndex = 3;
    } else if (section === "prices") {
      activeIndex = 2;
    } else {
      activeIndex = 1;
    }
  }

  return buildGuide("pricing", progress, steps, activeIndex);
}

function resolveStockGuide(
  pathname: string,
  progress: OnboardingProgress,
): OnboardingMicroStepState {
  const steps: MicroStepDef[] = [
    {
      label: "Ir a Inventario",
      title: "Abre Inventario",
      body: "El stock se registra en la misma pantalla donde tienes tus productos.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
    {
      label: "Registrar stock",
      title: "Registra cuánto stock tienes",
      body: "Abre cada producto y escribe cuántas unidades hay en bodega. Sin stock, no podrás vender con seguridad.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
  ];

  const activeIndex = pathname.startsWith("/inventario") ? 1 : 0;
  return buildGuide("stock", progress, steps, activeIndex);
}

function resolveFirstSaleGuide(
  pathname: string,
  progress: OnboardingProgress,
): OnboardingMicroStepState {
  const steps: MicroStepDef[] = [
    {
      label: "Ir a Nueva venta",
      title: "Abre Nueva venta",
      body: "En el menú lateral pulsa Nueva venta para registrar tu primer envío.",
      actionHref: "/venta",
      actionLabel: "Ir a Nueva venta",
    },
    {
      label: "Completar venta",
      title: "Haz tu primera venta de prueba",
      body: "Elige remitente y destinatario, selecciona el producto y cobra. Así cierras la configuración inicial.",
      actionHref: "/venta",
      actionLabel: "Ir a Nueva venta",
    },
  ];

  const activeIndex = pathname.startsWith("/venta") ? 1 : 0;
  return buildGuide("first_sale", progress, steps, activeIndex);
}

function resolveGuideForStep(
  stepId: OnboardingStepId,
  pathname: string,
  searchParams: URLSearchParams,
  progress: OnboardingProgress,
): OnboardingMicroStepState {
  switch (stepId) {
    case "countries":
      return resolveCountriesGuide(pathname, searchParams, progress);
    case "inventory":
      return resolveInventoryGuide(pathname, progress);
    case "pricing":
      return resolvePricingGuide(pathname, searchParams, progress);
    case "stock":
      return resolveStockGuide(pathname, progress);
    case "first_sale":
      return resolveFirstSaleGuide(pathname, progress);
  }
}

export function resolveOnboardingGuide(
  pathname: string,
  searchParams: URLSearchParams,
  progress: OnboardingProgress | null,
): OnboardingMicroStepState | null {
  if (!progress?.eligible || progress.allComplete) {
    return null;
  }

  const step = currentIncompleteStep(progress);
  if (!step) {
    return null;
  }

  return resolveGuideForStep(step.id, pathname, searchParams, progress);
}

export function resolveOnboardingGuideForStep(
  stepId: OnboardingStepId,
  pathname: string,
  searchParams: URLSearchParams,
  progress: OnboardingProgress,
): OnboardingMicroStepState | null {
  const step = progress.steps.find((item) => item.id === stepId);
  if (!step || step.completed) {
    return null;
  }

  return resolveGuideForStep(stepId, pathname, searchParams, progress);
}
