import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";

export type UiSurfacePaletteId = string;

type UiSurfaceListRowTokens = {
  hex: string;
  hoverHex: string;
  rowClass: string;
  hoverClass: string;
};

export type UiSurfacePalette = {
  id: UiSurfacePaletteId;
  label: string;
  tag: string;
  swatchClass: string;
  listRow: UiSurfaceListRowTokens;
  /** Si la paleta también sirve como tarjeta de cliente en venta. */
  personCardId?: SalePersonCardVariantId;
};

function listRow(bg: string, hover: string): UiSurfaceListRowTokens {
  return {
    hex: bg,
    hoverHex: hover,
    rowClass: `bg-[${bg}]`,
    hoverClass: `hover:bg-[${hover}]`,
  };
}

/** Catálogo unificado: filas vivas + variantes de venta enlazadas. */
export const UI_SURFACE_PALETTES: UiSurfacePalette[] = [
  {
    id: "sapphire",
    label: "Zafiro",
    tag: "A1",
    swatchClass: "bg-[#1e4a9e]",
    listRow: listRow("#1e4a9e", "#2563c4"),
  },
  {
    id: "emerald-vivid",
    label: "Esmeralda vivo",
    tag: "A2",
    swatchClass: "bg-[#0f7a52]",
    listRow: listRow("#0f7a52", "#12a06a"),
  },
  {
    id: "teal-vivid",
    label: "Teal vivo",
    tag: "A3",
    swatchClass: "bg-[#0a7a74]",
    listRow: listRow("#0a7a74", "#0e9a92"),
  },
  {
    id: "cyan-vivid",
    label: "Cian",
    tag: "A4",
    swatchClass: "bg-[#0a6e94]",
    listRow: listRow("#0a6e94", "#0d8eb8"),
  },
  {
    id: "indigo-vivid",
    label: "Índigo",
    tag: "A5",
    swatchClass: "bg-[#3b38b0]",
    listRow: listRow("#3b38b0", "#4f4ad4"),
  },
  {
    id: "violet-vivid",
    label: "Violeta vivo",
    tag: "A6",
    swatchClass: "bg-[#6b2fc4]",
    listRow: listRow("#6b2fc4", "#8248e0"),
  },
  {
    id: "magenta-vivid",
    label: "Magenta",
    tag: "A7",
    swatchClass: "bg-[#9a2d7a]",
    listRow: listRow("#9a2d7a", "#b83d96"),
  },
  {
    id: "rose-vivid",
    label: "Rosa fuerte",
    tag: "A8",
    swatchClass: "bg-[#a83252]",
    listRow: listRow("#a83252", "#c43d64"),
  },
  {
    id: "orange-vivid",
    label: "Naranja",
    tag: "A9",
    swatchClass: "bg-[#b84a14]",
    listRow: listRow("#b84a14", "#d85c1c"),
  },
  {
    id: "amber-vivid",
    label: "Ámbar vivo",
    tag: "A10",
    swatchClass: "bg-[#a67a0a]",
    listRow: listRow("#a67a0a", "#c49210"),
  },
  {
    id: "lime-vivid",
    label: "Lima",
    tag: "A11",
    swatchClass: "bg-[#4a8a14]",
    listRow: listRow("#4a8a14", "#5aa818"),
  },
  {
    id: "forest-vivid",
    label: "Verde bosque",
    tag: "A12",
    swatchClass: "bg-[#2a7a30]",
    listRow: listRow("#2a7a30", "#34963c"),
  },
  {
    id: "ocean-vivid",
    label: "Océano",
    tag: "A13",
    swatchClass: "bg-[#1458a8]",
    listRow: listRow("#1458a8", "#1a6cc8"),
  },
  {
    id: "plum-vivid",
    label: "Ciruela",
    tag: "A14",
    swatchClass: "bg-[#7a2d8a]",
    listRow: listRow("#7a2d8a", "#9438a8"),
  },
  {
    id: "copper-vivid",
    label: "Cobre vivo",
    tag: "A15",
    swatchClass: "bg-[#9a4a22]",
    listRow: listRow("#9a4a22", "#b85c2a"),
  },
  {
    id: "emerald-classic",
    label: "Esmeralda",
    tag: "V1",
    swatchClass: "bg-[#3a4842]",
    listRow: listRow("#3a4842", "#425048"),
    personCardId: "emerald-classic",
  },
  {
    id: "slate-cold",
    label: "Pizarra",
    tag: "V2",
    swatchClass: "bg-[#2c3440]",
    listRow: listRow("#2c3440", "#323c4a"),
    personCardId: "slate-cold",
  },
  {
    id: "amber-warm",
    label: "Ámbar",
    tag: "V3",
    swatchClass: "bg-[#3d3428]",
    listRow: listRow("#3d3428", "#463c2e"),
    personCardId: "amber-warm",
  },
  {
    id: "forest-deep",
    label: "Bosque",
    tag: "V4",
    swatchClass: "bg-[#243028]",
    listRow: listRow("#243028", "#2a3830"),
    personCardId: "forest-deep",
  },
  {
    id: "teal-mist",
    label: "Teal",
    tag: "V5",
    swatchClass: "bg-[#1e3336]",
    listRow: listRow("#1e3336", "#243a3e"),
    personCardId: "teal-mist",
  },
  {
    id: "rose-ops",
    label: "Rosa",
    tag: "V6",
    swatchClass: "bg-[#3a2c32]",
    listRow: listRow("#3a2c32", "#443238"),
    personCardId: "rose-ops",
  },
  {
    id: "side-bar",
    label: "Musgo",
    tag: "V7",
    swatchClass: "bg-[#2f3834]",
    listRow: listRow("#2f3834", "#36423d"),
    personCardId: "side-bar",
  },
  {
    id: "flat-minimal",
    label: "Grafito",
    tag: "V8",
    swatchClass: "bg-[#333a38]",
    listRow: listRow("#333a38", "#3a4240"),
    personCardId: "flat-minimal",
  },
  {
    id: "high-contrast",
    label: "Noche",
    tag: "V9",
    swatchClass: "bg-[#121212]",
    listRow: listRow("#121212", "#181818"),
    personCardId: "high-contrast",
  },
  {
    id: "violet-dusk",
    label: "Violeta",
    tag: "V10",
    swatchClass: "bg-[#322a3e]",
    listRow: listRow("#322a3e", "#3a3048"),
    personCardId: "violet-dusk",
  },
];

export const DEFAULT_LIST_ROW_PALETTE_ID = "slate-cold";
export const DEFAULT_PERSON_CARD_PALETTE_ID = "amber-warm";

const paletteById = new Map(UI_SURFACE_PALETTES.map((palette) => [palette.id, palette]));

export function resolveUiSurfacePalette(
  id?: string | null,
  customById?: Map<string, UiSurfacePalette>,
): UiSurfacePalette {
  if (id && customById?.has(id)) {
    return customById.get(id)!;
  }
  if (id && paletteById.has(id)) {
    return paletteById.get(id)!;
  }
  return paletteById.get(DEFAULT_LIST_ROW_PALETTE_ID)!;
}

export function isCatalogPaletteId(value: string): boolean {
  return paletteById.has(value);
}

export function uiSurfacePalettesForKind(kind: "listRow" | "personCard") {
  if (kind === "personCard") {
    return UI_SURFACE_PALETTES.filter((palette) => palette.personCardId);
  }
  return UI_SURFACE_PALETTES;
}

export function applyListRowCssVariables(palette: UiSurfacePalette, root: HTMLElement = document.documentElement) {
  root.style.setProperty("--surface-list-row", palette.listRow.hex);
  root.style.setProperty("--surface-list-row-hover", palette.listRow.hoverHex);
}
