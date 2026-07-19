import type { OnboardingProgress, OnboardingStepId } from "@/app/actions/onboarding";
import { configPricesCountryHref } from "@/lib/country-options";
import { inventarioHrefWithReturn } from "@/lib/inventario-return";

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
      body: "En el menú lateral pulsa Configuración. Ahí preparas países, precios y el resto de tu paquetería.",
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
      body: "Elige un país de la lista y pulsa Agregar. Si no ves la lista, pulsa Agregar país arriba.",
      actionHref: "/configuracion?view=prices",
      actionLabel: "Ver países",
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
      body: "Menú lateral → Inventario. Aquí creas categorías y los productos que vendes.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
    {
      label: "Crear categoría",
      title: "Crea tu primera categoría",
      body: "Pulsa el icono de estructura para crear la primera categoría. Ejemplo: Cajas.",
      actionHref: "/inventario",
      actionLabel: "Ir a Inventario",
    },
    {
      label: "Agregar item",
      title: "Agrega tu primer producto",
      body: "Elige la categoría en el filtro superior y pulsa Agregar. Escribe un nombre como Mediana o 14×14×14 y confirma.",
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
  const inventarioHref = inventarioHrefWithReturn(countryHref);

  const steps: MicroStepDef[] = [
    {
      label: "Ir a Configuración",
      title: "Abre Configuración",
      body: "Los precios por país se configuran en Configuración → Países y precios.",
      actionHref: "/configuracion?view=prices",
      actionLabel: "Ir a Países y precios",
    },
    {
      label: "Elegir país",
      title: "Selecciona un país",
      body: "En la lista pulsa el país al que quieres asignar productos y precios de venta.",
      actionHref: "/configuracion?view=prices",
      actionLabel: "Ver países",
    },
    {
      label: "Vincular productos",
      title: "Agrega productos al país",
      body: "Si no hay productos en el catálogo, créalos en Inventario. Si ya existen, pulsa + Agregar ítems y elígelos. Al terminar, usa la flecha junto a Boxario para volver a precios.",
      actionHref: inventarioHref,
      actionLabel: "Ir a Inventario",
    },
    {
      label: "Asignar precios",
      title: "Pon precio de venta",
      body: "En la pestaña Items escribe el precio de cada producto para ese país. También puedes registrar costo y ver la ganancia.",
      actionHref: countryHref,
      actionLabel: "Ir a precios",
    },
  ];

  let activeIndex = 0;

  if (pathname.startsWith("/inventario")) {
    activeIndex = 2;
  } else if (pathname.startsWith("/configuracion")) {
    const section = parseConfigSection(searchParams);
    const country = searchParams.get("country")?.trim();

    if (section === "prices" && country) {
      activeIndex = 3;
    } else if (section === "prices") {
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
      body: "Abre un producto de la lista y escribe cuántas unidades hay en bodega. Sin stock no podrás vender con seguridad.",
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
      body: "Menú lateral → Nueva venta. Aquí registras remitentes, destinatarios y cobras envíos.",
      actionHref: "/venta",
      actionLabel: "Ir a Nueva venta",
    },
    {
      label: "Remitente y destinatario",
      title: "Crea remitente y destinatario",
      body: "Agrega un remitente y luego un destinatario con su país y dirección. Si falta país o productos, la app te llevará a configurarlos.",
      actionHref: "/venta",
      actionLabel: "Ir a Nueva venta",
    },
    {
      label: "Cobrar envío",
      title: "Elige producto y cobra",
      body: "Selecciona el producto, revisa el precio, añádelo al carrito y completa el pago. Con eso cierras tu configuración inicial.",
      actionHref: "/venta",
      actionLabel: "Ir a Nueva venta",
    },
  ];

  let activeIndex = 0;

  if (pathname.startsWith("/venta")) {
    activeIndex = 1;
  }

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
