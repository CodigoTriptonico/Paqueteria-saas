import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import { SALE_PERSON_CARD_VARIANTS } from "@/components/sale/sale-person-card-variants";
import {
  colorDistance,
  defaultHoverHex,
  normalizeHex,
  randomCustomPaletteId,
} from "@/lib/ui-surface-color-math";
import type { UiSurfacePalette, UiSurfacePaletteId } from "@/lib/ui-surface-palettes";

const CUSTOM_PALETTE_ID_PREFIX = "custom:";

export type UiSurfaceCustomPalette = {
  id: UiSurfacePaletteId;
  label: string;
  baseHex: string;
  hoverHex: string;
  createdAt: string;
};

export function isCustomPaletteId(id: string): boolean {
  return id.startsWith(CUSTOM_PALETTE_ID_PREFIX);
}

export function buildCustomUiSurfacePalette(custom: UiSurfaceCustomPalette): UiSurfacePalette {
  const base = normalizeHex(custom.baseHex) ?? "#2c3440";
  const hover = normalizeHex(custom.hoverHex) ?? defaultHoverHex(base);
  return {
    id: custom.id,
    label: custom.label,
    tag: "★",
    swatchClass: `bg-[${base}]`,
    listRow: {
      hex: base,
      hoverHex: hover,
      rowClass: "bg-surface-list-row",
      hoverClass: "hover:bg-surface-list-row-hover",
    },
    personCardId: nearestPersonCardVariantId(base),
  };
}

export function createCustomPalette(input: {
  label: string;
  baseHex: string;
  hoverHex?: string;
}): UiSurfaceCustomPalette | null {
  const baseHex = normalizeHex(input.baseHex);
  if (!baseHex) {
    return null;
  }
  const hoverHex = input.hoverHex ? normalizeHex(input.hoverHex) : defaultHoverHex(baseHex);
  if (!hoverHex) {
    return null;
  }
  const label = input.label.trim() || "Mi color";
  return {
    id: randomCustomPaletteId(),
    label,
    baseHex,
    hoverHex,
    createdAt: new Date().toISOString(),
  };
}

export function sanitizeCustomPalette(raw: unknown): UiSurfaceCustomPalette | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Partial<UiSurfaceCustomPalette>;
  if (typeof record.id !== "string" || !isCustomPaletteId(record.id)) {
    return null;
  }
  const baseHex = normalizeHex(typeof record.baseHex === "string" ? record.baseHex : "");
  if (!baseHex) {
    return null;
  }
  const hoverHex =
    normalizeHex(typeof record.hoverHex === "string" ? record.hoverHex : "") ?? defaultHoverHex(baseHex);
  return {
    id: record.id,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : "Mi color",
    baseHex,
    hoverHex,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
  };
}

export function customPalettesToMap(customPalettes: UiSurfaceCustomPalette[]) {
  return new Map(customPalettes.map((entry) => [entry.id, buildCustomUiSurfacePalette(entry)]));
}

function nearestPersonCardVariantId(hex: string): SalePersonCardVariantId {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return "amber-warm";
  }

  let best: SalePersonCardVariantId = "amber-warm";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const variant of SALE_PERSON_CARD_VARIANTS) {
    const match = variant.swatch.match(/#([0-9a-f]{6})/i);
    const swatchHex = match ? `#${match[1].toLowerCase()}` : null;
    if (!swatchHex) {
      continue;
    }
    const distance = colorDistance(normalized, swatchHex);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = variant.id;
    }
  }

  return best;
}
