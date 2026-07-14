import type { UiSurfacePaletteId } from "@/lib/ui-surface-palettes";

export type UiSurfaceThemeId =
  | "all"
  | "vivid"
  | "classic"
  | "ocean"
  | "warm"
  | "nature"
  | "night";

export type UiSurfaceThemeGroup = {
  id: UiSurfaceThemeId;
  label: string;
  description: string;
  paletteIds: UiSurfacePaletteId[];
  /** Gradiente decorativo para la tarjeta del tema. */
  gradient: string;
};

export const UI_SURFACE_THEME_GROUPS: UiSurfaceThemeGroup[] = [
  {
    id: "all",
    label: "Todos",
    description: "Catálogo completo",
    paletteIds: [],
    gradient: "from-slate-600 via-slate-500 to-slate-700",
  },
  {
    id: "vivid",
    label: "Vivos",
    description: "Colores saturados para listados operativos",
    paletteIds: [
      "sapphire",
      "emerald-vivid",
      "teal-vivid",
      "cyan-vivid",
      "indigo-vivid",
      "violet-vivid",
      "magenta-vivid",
      "rose-vivid",
      "orange-vivid",
      "amber-vivid",
      "lime-vivid",
      "forest-vivid",
      "ocean-vivid",
      "plum-vivid",
      "copper-vivid",
    ],
    gradient: "from-[#1e4a9e] via-[#6b2fc4] to-[#a83252]",
  },
  {
    id: "classic",
    label: "Clásicos",
    description: "Tonos suaves tipo tarjeta de cliente",
    paletteIds: [
      "emerald-classic",
      "slate-cold",
      "amber-warm",
      "forest-deep",
      "teal-mist",
      "rose-ops",
      "side-bar",
      "flat-minimal",
      "high-contrast",
      "violet-dusk",
    ],
    gradient: "from-[#3a4842] via-[#3d3428] to-[#322a3e]",
  },
  {
    id: "ocean",
    label: "Océano",
    description: "Azules, cianes y teals",
    paletteIds: ["sapphire", "cyan-vivid", "teal-vivid", "ocean-vivid", "teal-mist", "indigo-vivid"],
    gradient: "from-[#1458a8] via-[#0a6e94] to-[#1e3336]",
  },
  {
    id: "warm",
    label: "Cálidos",
    description: "Ámbar, naranja y rosa",
    paletteIds: ["amber-vivid", "amber-warm", "orange-vivid", "rose-vivid", "rose-ops", "copper-vivid"],
    gradient: "from-[#b84a14] via-[#a67a0a] to-[#a83252]",
  },
  {
    id: "nature",
    label: "Naturaleza",
    description: "Verdes y bosque",
    paletteIds: ["emerald-vivid", "forest-vivid", "lime-vivid", "emerald-classic", "forest-deep", "side-bar"],
    gradient: "from-[#0f7a52] via-[#2a7a30] to-[#243028]",
  },
  {
    id: "night",
    label: "Noche",
    description: "Oscuros y alto contraste",
    paletteIds: ["slate-cold", "high-contrast", "flat-minimal", "violet-dusk", "indigo-vivid", "plum-vivid"],
    gradient: "from-[#121212] via-[#2c3440] to-[#322a3e]",
  },
];

function uiSurfaceThemeById(id: UiSurfaceThemeId) {
  return UI_SURFACE_THEME_GROUPS.find((theme) => theme.id === id) ?? UI_SURFACE_THEME_GROUPS[0];
}

export function paletteIdsForTheme(themeId: UiSurfaceThemeId, catalogIds: UiSurfacePaletteId[]) {
  const theme = uiSurfaceThemeById(themeId);
  if (theme.id === "all" || theme.paletteIds.length === 0) {
    return catalogIds;
  }
  const allowed = new Set(theme.paletteIds);
  return catalogIds.filter((id) => allowed.has(id));
}
