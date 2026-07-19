import type { OnboardingProgress } from "@/app/actions/onboarding";
import type { OnboardingMicroStepState } from "@/lib/onboarding/micro-steps";

// Tiempo suficiente para leer el panel completo antes de mostrar el coach.
export const ONBOARDING_COACH_IDLE_MS = 12_000;

export const ONBOARDING_TARGETS = {
  NOTIFICATIONS_ACTION: "onboarding-notifications-action",
  NAV_CONFIGURACION: "nav-configuracion",
  NAV_INVENTARIO: "nav-inventario",
  NAV_VENTA: "nav-venta",
  CONFIG_PRICES_CARD: "config-prices-card",
  CONFIG_ADD_COUNTRY: "config-add-country",
  CONFIG_COUNTRY_PICKER: "config-country-picker",
  CONFIG_ADD_COUNTRY_PRODUCTS: "config-add-country-products",
  CONFIG_GO_INVENTARIO: "config-go-inventario",
  CONFIG_COUNTRY_PRICE: "config-country-price",
  INVENTORY_ADD_CATEGORY: "inventory-add-category",
  INVENTORY_STRUCTURE_MENU: "inventory-structure-menu",
  INVENTORY_RETURN_PRICING: "inventory-return-pricing",
  INVENTORY_STOCK_ITEM: "inventory-stock-item",
  VENTA_NEW_SENDER: "venta-new-sender",
  VENTA_NEW_RECIPIENT: "venta-new-recipient",
  VENTA_SELECT_PRODUCT: "venta-select-product",
} as const;

export type OnboardingTargetKey =
  (typeof ONBOARDING_TARGETS)[keyof typeof ONBOARDING_TARGETS];

export type OnboardingCoachHint = {
  targetKey: OnboardingTargetKey;
  extraTargetKeys?: OnboardingTargetKey[];
  title: string;
  body: string;
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

function hint(
  targetKey: OnboardingTargetKey,
  title: string,
  body: string,
  extraTargetKeys?: OnboardingTargetKey[],
): OnboardingCoachHint {
  return { targetKey, title, body, extraTargetKeys };
}

function shouldOfferInventarioPageShortcut(
  pathname: string,
  searchParams: URLSearchParams,
  progress?: OnboardingProgress | null,
) {
  const configSection = parseConfigSection(searchParams);
  const country = searchParams.get("country")?.trim();

  return (
    pathname.startsWith("/configuracion") &&
    configSection === "prices" &&
    Boolean(country) &&
    !progress?.inventoryHasItems
  );
}

function inventarioEntryCoachHint(
  title: string,
  pathname: string,
  searchParams: URLSearchParams,
  progress?: OnboardingProgress | null,
) {
  if (shouldOfferInventarioPageShortcut(pathname, searchParams, progress)) {
    return hint(
      ONBOARDING_TARGETS.NAV_INVENTARIO,
      title,
      "Pulsa Inventario en el menú lateral o el botón Ir a Inventario.",
      [ONBOARDING_TARGETS.CONFIG_GO_INVENTARIO],
    );
  }

  return hint(
    ONBOARDING_TARGETS.NAV_INVENTARIO,
    title,
    "Pulsa Inventario en el menú lateral.",
  );
}

function isNavCoachTarget(targetKey: OnboardingTargetKey) {
  return (
    targetKey === ONBOARDING_TARGETS.NAV_CONFIGURACION ||
    targetKey === ONBOARDING_TARGETS.NAV_INVENTARIO ||
    targetKey === ONBOARDING_TARGETS.NAV_VENTA
  );
}

function notificationsPanelHint(
  guide: OnboardingMicroStepState,
  pageHint: OnboardingCoachHint,
): OnboardingCoachHint {
  const actionLabel = guide.actionLabel?.trim() || "continuar";

  return hint(
    ONBOARDING_TARGETS.NOTIFICATIONS_ACTION,
    pageHint.title,
    `Pulsa «${actionLabel}» en este panel de notificaciones.`,
  );
}

function finalizeCoachHint(
  guide: OnboardingMicroStepState,
  pageHint: OnboardingCoachHint | null,
  notificationsPanelOpen: boolean,
): OnboardingCoachHint | null {
  if (!pageHint) {
    return null;
  }

  if (
    notificationsPanelOpen &&
    guide.actionHref &&
    guide.actionLabel &&
    isNavCoachTarget(pageHint.targetKey)
  ) {
    return notificationsPanelHint(guide, pageHint);
  }

  return pageHint;
}

export function resolveOnboardingCoachHint(
  guide: OnboardingMicroStepState | null,
  pathname: string,
  searchParams: URLSearchParams,
  progress?: OnboardingProgress | null,
  notificationsPanelOpen = false,
): OnboardingCoachHint | null {
  if (!guide) {
    return null;
  }

  // Mientras Notificaciones está abierta, la acción correcta es el botón del
  // paso dentro del panel. No debemos seguir resaltando ni tapando la pantalla
  // que quedó detrás del panel.
  if (notificationsPanelOpen && guide.actionHref && guide.actionLabel) {
    return notificationsPanelHint(
      guide,
      hint(ONBOARDING_TARGETS.NOTIFICATIONS_ACTION, guide.title, guide.body),
    );
  }

  const { stepId, microStepIndex, title, body } = guide;
  const configSection = parseConfigSection(searchParams);
  const country = searchParams.get("country")?.trim();

  switch (stepId) {
    case "countries":
      if (microStepIndex === 1 && !pathname.startsWith("/configuracion")) {
        return finalizeCoachHint(
          guide,
          hint(
            ONBOARDING_TARGETS.NAV_CONFIGURACION,
            title,
            "Pulsa Configuración en el menú lateral.",
          ),
          notificationsPanelOpen,
        );
      }

      if (microStepIndex === 2 && configSection !== "prices") {
        return finalizeCoachHint(
          guide,
          hint(
            ONBOARDING_TARGETS.CONFIG_PRICES_CARD,
            title,
            "Abre la tarjeta Países y precios (icono de globo).",
          ),
          notificationsPanelOpen,
        );
      }

      if (microStepIndex === 3) {
        if (configSection === "prices" && !country) {
          return hint(
            ONBOARDING_TARGETS.CONFIG_COUNTRY_PICKER,
            title,
            "Elige un país de la lista y pulsa Agregar.",
          );
        }

        return hint(ONBOARDING_TARGETS.CONFIG_ADD_COUNTRY, title, body);
      }

      return null;

    case "inventory":
      if (microStepIndex === 1 && !pathname.startsWith("/inventario")) {
        return finalizeCoachHint(
          guide,
          inventarioEntryCoachHint(title, pathname, searchParams, progress),
          notificationsPanelOpen,
        );
      }

      if (microStepIndex === 2) {
        if (!progress?.inventoryHasCategory) {
          return hint(
            ONBOARDING_TARGETS.INVENTORY_ADD_CATEGORY,
            title,
            "Crea tu primera categoría aquí.",
          );
        }

        return hint(
          ONBOARDING_TARGETS.INVENTORY_STRUCTURE_MENU,
          title,
          "Pulsa el icono de estructura para crear una categoría nueva.",
        );
      }

      if (microStepIndex === 3) {
        return hint(
          ONBOARDING_TARGETS.INVENTORY_STRUCTURE_MENU,
          title,
          "Pulsa Agregar para crear el primer artículo.",
        );
      }

      return null;

    case "pricing":
      if (microStepIndex === 1 && configSection !== "prices") {
        return finalizeCoachHint(
          guide,
          hint(
            ONBOARDING_TARGETS.CONFIG_PRICES_CARD,
            title,
            "Abre Países y precios en Configuración.",
          ),
          notificationsPanelOpen,
        );
      }

      if (microStepIndex === 2 && configSection === "prices" && !country) {
        return hint(
          ONBOARDING_TARGETS.CONFIG_COUNTRY_PICKER,
          title,
          "Selecciona el país al que quieres poner precios.",
        );
      }

      if (microStepIndex === 3) {
        if (pathname.startsWith("/inventario")) {
          return hint(
            ONBOARDING_TARGETS.INVENTORY_RETURN_PRICING,
            title,
            "Cuando termines, pulsa la flecha junto a Boxario.",
          );
        }

        if (configSection === "prices" && country) {
          if (!progress?.inventoryHasItems) {
            return inventarioEntryCoachHint(title, pathname, searchParams, progress);
          }

          return hint(
            ONBOARDING_TARGETS.CONFIG_ADD_COUNTRY_PRODUCTS,
            title,
            "Agrega productos del catálogo a este país o créalos primero en Inventario.",
          );
        }

        return finalizeCoachHint(
          guide,
          inventarioEntryCoachHint(title, pathname, searchParams, progress),
          notificationsPanelOpen,
        );
      }

      if (microStepIndex === 4) {
        if (configSection === "prices" && country) {
          return hint(
            ONBOARDING_TARGETS.CONFIG_COUNTRY_PRICE,
            title,
            "Escribe el precio de venta de cada producto.",
          );
        }

        return hint(
          ONBOARDING_TARGETS.CONFIG_ADD_COUNTRY_PRODUCTS,
          title,
          "Agrega productos del catálogo a este país.",
        );
      }

      return null;

    case "stock":
      if (microStepIndex === 1 && !pathname.startsWith("/inventario")) {
        return finalizeCoachHint(
          guide,
          inventarioEntryCoachHint(title, pathname, searchParams, progress),
          notificationsPanelOpen,
        );
      }

      return hint(
        ONBOARDING_TARGETS.INVENTORY_STOCK_ITEM,
        title,
        "Abre un producto y registra cuántas unidades hay en bodega.",
      );

    case "first_sale":
      if (microStepIndex === 1 && !pathname.startsWith("/venta")) {
        return finalizeCoachHint(
          guide,
          hint(
            ONBOARDING_TARGETS.NAV_VENTA,
            title,
            "Pulsa Nueva venta en el menú lateral.",
          ),
          notificationsPanelOpen,
        );
      }

      if (microStepIndex === 2) {
        return hint(
          ONBOARDING_TARGETS.VENTA_NEW_SENDER,
          title,
          "Empieza creando un remitente y luego un destinatario.",
        );
      }

      if (microStepIndex === 3) {
        return hint(
          ONBOARDING_TARGETS.VENTA_SELECT_PRODUCT,
          title,
          "Elige el producto y completa el cobro.",
        );
      }

      return null;
  }
}

export function onboardingCoachTargetKeys(hint: OnboardingCoachHint): OnboardingTargetKey[] {
  const keys = [hint.targetKey, ...(hint.extraTargetKeys ?? [])];
  return [...new Set(keys)];
}

function onboardingCoachTargetSelector(targetKey: OnboardingTargetKey) {
  return `[data-onboarding-target="${targetKey}"]`;
}

function queryOnboardingCoachTarget(
  targetKey: OnboardingTargetKey,
): HTMLElement | null {
  const selector = onboardingCoachTargetSelector(targetKey);
  const panelRoot = document.querySelector<HTMLElement>(
    "[data-onboarding-notifications-panel]",
  );
  const scopedNodes = panelRoot
    ? panelRoot.querySelectorAll<HTMLElement>(selector)
    : [];
  const nodes =
    scopedNodes.length > 0
      ? scopedNodes
      : document.querySelectorAll<HTMLElement>(selector);

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();

    if (rect.width > 0 && rect.height > 0) {
      return node;
    }
  }

  return null;
}

export function queryOnboardingCoachTargets(
  targetKeys: OnboardingTargetKey[],
): HTMLElement[] {
  const elements: HTMLElement[] = [];

  for (const targetKey of targetKeys) {
    const target = queryOnboardingCoachTarget(targetKey);

    if (target && !elements.includes(target)) {
      elements.push(target);
    }
  }

  return elements;
}

export type OnboardingCoachRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const COACH_TARGET_PAD = 6;

export function coachRectsForElements(
  elements: HTMLElement[],
  pad = COACH_TARGET_PAD,
): OnboardingCoachRect[] {
  return elements.map((element) => {
    const rect = element.getBoundingClientRect();

    return {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
  });
}

const COACH_TOOLTIP_ANCHOR_MAX_HEIGHT = 140;

function coachTooltipAnchorStrip(rect: OnboardingCoachRect): OnboardingCoachRect {
  const anchorHeight = Math.min(
    rect.height,
    Math.max(72, Math.min(COACH_TOOLTIP_ANCHOR_MAX_HEIGHT, rect.height * 0.28)),
  );

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: anchorHeight,
  };
}

function unionCoachRect(rects: OnboardingCoachRect[]): OnboardingCoachRect {
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
}

export function coachTooltipAnchorRect(elements: HTMLElement[]): OnboardingCoachRect | null {
  if (elements.length === 0) {
    return null;
  }

  const rects = coachRectsForElements(elements, 0);
  const union = elements.length === 1 ? rects[0] : unionCoachRect(rects);

  return coachTooltipAnchorStrip(union);
}

export function computeCoachTooltipPosition(
  rect: OnboardingCoachRect,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const tooltipWidth = Math.min(320, viewportWidth - 24);
  const anchorTop = rect.top;
  const anchorBottom = rect.top + rect.height;
  const anchorLeft = rect.left + rect.width / 2;
  const spaceBelow = viewportHeight - anchorBottom;
  const spaceAbove = anchorTop;
  const preferBelow = spaceBelow >= tooltipHeight + 16 || spaceBelow >= spaceAbove;

  const top = preferBelow
    ? anchorBottom + 12
    : Math.max(12, anchorTop - tooltipHeight - 12);

  const left = Math.min(
    Math.max(12, anchorLeft - tooltipWidth / 2),
    viewportWidth - tooltipWidth - 12,
  );

  return {
    top,
    left,
    width: tooltipWidth,
    placement: preferBelow ? ("below" as const) : ("above" as const),
  };
}
