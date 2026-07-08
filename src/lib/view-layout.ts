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

export function readViewLayout(): ViewLayout {
  if (typeof window === "undefined") {
    return DEFAULT_VIEW_LAYOUT;
  }

  try {
    const current = window.localStorage.getItem(VIEW_LAYOUT_STORAGE_KEY);
    if (current) {
      return parseViewLayout(current);
    }

    return parseViewLayout(
      window.localStorage.getItem(LEGACY_ENVIOS_VIEW_LAYOUT_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_VIEW_LAYOUT;
  }
}

export function writeViewLayout(layout: ViewLayout): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(VIEW_LAYOUT_STORAGE_KEY, layout);
}

export function viewLayoutToggleLabel(layout: ViewLayout): string {
  return layout === "rows" ? "Ver como tarjetas" : "Ver como filas";
}

export function viewLayoutAriaLabel(layout: ViewLayout): string {
  return layout === "rows" ? "Cambiar a vista tarjetas" : "Cambiar a vista filas";
}
