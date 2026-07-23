export type ViewLayout = "rows" | "cards";

export const VIEW_LAYOUT_STORAGE_KEY = "boxario:view-layout";
export const LEGACY_ENVIOS_VIEW_LAYOUT_STORAGE_KEY = "boxario:envios:view-layout";
export const DEFAULT_VIEW_LAYOUT: ViewLayout = "rows";

export function parseViewLayout(value: unknown): ViewLayout {
  return value === "cards" ? "cards" : "rows";
}

export function toggleViewLayout(layout: ViewLayout): ViewLayout {
  return layout === "rows" ? "cards" : "rows";
}

export function viewLayoutToggleLabel(layout: ViewLayout): string {
  return layout === "rows" ? "Ver como tarjetas" : "Ver como filas";
}

export function viewLayoutAriaLabel(layout: ViewLayout): string {
  return layout === "rows" ? "Cambiar a vista tarjetas" : "Cambiar a vista filas";
}
