import {
  DEFAULT_LIST_ROW_PALETTE_ID,
  DEFAULT_PERSON_CARD_PALETTE_ID,
  isCatalogPaletteId,
  type UiSurfacePaletteId,
} from "@/lib/ui-surface-palettes";
import {
  isCustomPaletteId,
  sanitizeCustomPalette,
  type UiSurfaceCustomPalette,
} from "@/lib/ui-surface-custom-palettes";
import {
  isUiSurfaceContextId,
  UI_SURFACE_CONTEXT_IDS,
  type UiSurfaceContextId,
} from "@/lib/ui-surface-context";
import {
  DEFAULT_VIEW_LAYOUT,
  toggleViewLayout,
  type ViewLayout,
} from "@/lib/view-layout";

export const UI_SURFACE_PREFERENCES_STORAGE_KEY = "boxario-ui-surfaces:v2";

export type UiSurfacePreferences = {
  version: 2;
  /** Paleta elegida por contexto (página / listado). */
  byContext: Partial<Record<UiSurfaceContextId, UiSurfacePaletteId>>;
  /** Colores personalizados guardados por el usuario. */
  customPalettes: UiSurfaceCustomPalette[];
  /** Vista filas / tarjetas por contexto de página. */
  viewLayoutByContext: Partial<Record<UiSurfaceContextId, ViewLayout>>;
};

const DEFAULT_BY_CONTEXT: Partial<Record<UiSurfaceContextId, UiSurfacePaletteId>> = {
  "logistics.tasks": DEFAULT_LIST_ROW_PALETTE_ID,
  "shipments.tracking": DEFAULT_LIST_ROW_PALETTE_ID,
  "conductor.tasks": DEFAULT_LIST_ROW_PALETTE_ID,
  "stats.sales": DEFAULT_LIST_ROW_PALETTE_ID,
  "timeclock.admin": DEFAULT_LIST_ROW_PALETTE_ID,
  "sale.senderCard": DEFAULT_PERSON_CARD_PALETTE_ID,
  "sale.recipientCard": DEFAULT_PERSON_CARD_PALETTE_ID,
};

export function defaultUiSurfacePreferences(): UiSurfacePreferences {
  return {
    version: 2,
    byContext: { ...DEFAULT_BY_CONTEXT },
    customPalettes: [],
    viewLayoutByContext: {},
  };
}

function isValidPaletteReference(
  paletteId: string,
  customPalettes: UiSurfaceCustomPalette[],
): boolean {
  if (isCatalogPaletteId(paletteId)) {
    return true;
  }
  if (isCustomPaletteId(paletteId)) {
    return customPalettes.some((entry) => entry.id === paletteId);
  }
  return false;
}

function sanitizePreferences(raw: unknown): UiSurfacePreferences {
  const base = defaultUiSurfacePreferences();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const record = raw as Partial<UiSurfacePreferences> & { version?: number };
  const customPalettes = Array.isArray(record.customPalettes)
    ? record.customPalettes
        .map((entry) => sanitizeCustomPalette(entry))
        .filter((entry): entry is UiSurfaceCustomPalette => Boolean(entry))
    : [];

  const byContext = { ...base.byContext };
  const viewLayoutByContext = { ...base.viewLayoutByContext };

  if (record.byContext && typeof record.byContext === "object") {
    for (const contextId of UI_SURFACE_CONTEXT_IDS) {
      const paletteId = record.byContext[contextId];
      if (typeof paletteId === "string" && isValidPaletteReference(paletteId, customPalettes)) {
        byContext[contextId] = paletteId;
      }
    }
  }

  if (record.viewLayoutByContext && typeof record.viewLayoutByContext === "object") {
    for (const contextId of UI_SURFACE_CONTEXT_IDS) {
      const layout = record.viewLayoutByContext[contextId];
      if (layout === "rows" || layout === "cards") {
        viewLayoutByContext[contextId] = layout;
      }
    }
  }

  return { version: 2, byContext, customPalettes, viewLayoutByContext };
}

/** Migra v1 (solo byContext) a v2. */
function migrateUiSurfacePreferences(raw: unknown): UiSurfacePreferences {
  if (!raw || typeof raw !== "object") {
    return defaultUiSurfacePreferences();
  }
  const record = raw as { version?: number; byContext?: unknown; customPalettes?: unknown };
  if (record.version === 2) {
    return sanitizePreferences(record);
  }
  return sanitizePreferences({
    version: 2,
    byContext: record.byContext,
    customPalettes: [],
    viewLayoutByContext: {},
  });
}

export function readUiSurfacePreferences(): UiSurfacePreferences {
  if (typeof window === "undefined") {
    return defaultUiSurfacePreferences();
  }

  try {
    const keys = [UI_SURFACE_PREFERENCES_STORAGE_KEY, "boxario-ui-surfaces:v1"];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = migrateUiSurfacePreferences(JSON.parse(raw));
      if (key !== UI_SURFACE_PREFERENCES_STORAGE_KEY) {
        writeUiSurfacePreferences(parsed);
      }
      return parsed;
    }
    return defaultUiSurfacePreferences();
  } catch {
    return defaultUiSurfacePreferences();
  }
}

export function writeUiSurfacePreferences(preferences: UiSurfacePreferences) {
  if (typeof window === "undefined") {
    return;
  }
  const next = sanitizePreferences(preferences);
  window.localStorage.setItem(UI_SURFACE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
}

export function paletteIdForContext(
  preferences: UiSurfacePreferences,
  contextId: UiSurfaceContextId,
): UiSurfacePaletteId {
  return preferences.byContext[contextId] ?? DEFAULT_BY_CONTEXT[contextId] ?? DEFAULT_LIST_ROW_PALETTE_ID;
}

export function defaultPaletteIdForContext(contextId: UiSurfaceContextId): UiSurfacePaletteId {
  return DEFAULT_BY_CONTEXT[contextId] ?? DEFAULT_LIST_ROW_PALETTE_ID;
}

export function resetPaletteForContext(
  preferences: UiSurfacePreferences,
  contextId: UiSurfaceContextId,
): UiSurfacePreferences {
  if (!isUiSurfaceContextId(contextId)) {
    return preferences;
  }
  return setPaletteForContext(preferences, contextId, defaultPaletteIdForContext(contextId));
}

export function resetAllContextPalettes(preferences: UiSurfacePreferences): UiSurfacePreferences {
  return sanitizePreferences({
    ...preferences,
    byContext: { ...DEFAULT_BY_CONTEXT },
  });
}

export function setPaletteForContext(
  preferences: UiSurfacePreferences,
  contextId: UiSurfaceContextId,
  paletteId: UiSurfacePaletteId,
): UiSurfacePreferences {
  if (!isUiSurfaceContextId(contextId) || !isValidPaletteReference(paletteId, preferences.customPalettes)) {
    return preferences;
  }
  return {
    ...preferences,
    byContext: {
      ...preferences.byContext,
      [contextId]: paletteId,
    },
  };
}

export function addCustomPaletteToPreferences(
  preferences: UiSurfacePreferences,
  custom: UiSurfaceCustomPalette,
): UiSurfacePreferences {
  const withoutDuplicate = preferences.customPalettes.filter((entry) => entry.id !== custom.id);
  return sanitizePreferences({
    ...preferences,
    customPalettes: [custom, ...withoutDuplicate],
  });
}

export function removeCustomPaletteFromPreferences(
  preferences: UiSurfacePreferences,
  paletteId: UiSurfacePaletteId,
): UiSurfacePreferences {
  const customPalettes = preferences.customPalettes.filter((entry) => entry.id !== paletteId);
  const byContext = { ...preferences.byContext };
  for (const contextId of UI_SURFACE_CONTEXT_IDS) {
    if (byContext[contextId] === paletteId) {
      byContext[contextId] =
        DEFAULT_BY_CONTEXT[contextId] ?? DEFAULT_LIST_ROW_PALETTE_ID;
    }
  }
  return sanitizePreferences({
    ...preferences,
    byContext,
    customPalettes,
  });
}

export function viewLayoutForContext(
  preferences: UiSurfacePreferences,
  contextId: UiSurfaceContextId,
): ViewLayout {
  return preferences.viewLayoutByContext[contextId] ?? DEFAULT_VIEW_LAYOUT;
}

export function setViewLayoutForContext(
  preferences: UiSurfacePreferences,
  contextId: UiSurfaceContextId,
  layout: ViewLayout,
): UiSurfacePreferences {
  if (!isUiSurfaceContextId(contextId)) {
    return preferences;
  }
  return sanitizePreferences({
    ...preferences,
    viewLayoutByContext: {
      ...preferences.viewLayoutByContext,
      [contextId]: layout,
    },
  });
}

export function toggleViewLayoutForContext(
  preferences: UiSurfacePreferences,
  contextId: UiSurfaceContextId,
): UiSurfacePreferences {
  const current = viewLayoutForContext(preferences, contextId);
  return setViewLayoutForContext(preferences, contextId, toggleViewLayout(current));
}
