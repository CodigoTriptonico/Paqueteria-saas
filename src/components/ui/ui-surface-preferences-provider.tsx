"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UiSurfaceContextId } from "@/lib/ui-surface-context";
import {
  createCustomPalette,
  customPalettesToMap,
  type UiSurfaceCustomPalette,
} from "@/lib/ui-surface-custom-palettes";
import {
  applyListRowCssVariables,
  resolveUiSurfacePalette,
  type UiSurfacePalette,
  type UiSurfacePaletteId,
} from "@/lib/ui-surface-palettes";
import {
  addCustomPaletteToPreferences,
  paletteIdForContext,
  readUiSurfacePreferences,
  removeCustomPaletteFromPreferences,
  resetAllContextPalettes,
  resetPaletteForContext,
  setPaletteForContext,
  setViewLayoutForContext,
  toggleViewLayoutForContext,
  viewLayoutForContext,
  writeUiSurfacePreferences,
  type UiSurfacePreferences,
} from "@/lib/ui-surface-preferences";
import type { ViewLayout } from "@/lib/view-layout";

type UiSurfacePreferencesContextValue = {
  preferences: UiSurfacePreferences;
  customPalettes: UiSurfaceCustomPalette[];
  paletteForContext: (contextId: UiSurfaceContextId) => UiSurfacePalette;
  paletteIdForContext: (contextId: UiSurfaceContextId) => UiSurfacePaletteId;
  resolvePalette: (paletteId: UiSurfacePaletteId) => UiSurfacePalette;
  setContextPalette: (contextId: UiSurfaceContextId, paletteId: UiSurfacePaletteId) => void;
  saveCustomPalette: (input: { label: string; baseHex: string; hoverHex?: string }) => UiSurfacePaletteId | null;
  removeCustomPalette: (paletteId: UiSurfacePaletteId) => void;
  resetContextPalette: (contextId: UiSurfaceContextId) => void;
  resetAllContextPalettes: () => void;
  viewLayoutForContext: (contextId: UiSurfaceContextId) => ViewLayout;
  setViewLayoutForContext: (contextId: UiSurfaceContextId, layout: ViewLayout) => void;
  toggleViewLayoutForContext: (contextId: UiSurfaceContextId) => void;
};

const UiSurfacePreferencesContext = createContext<UiSurfacePreferencesContextValue | null>(null);

export function UiSurfacePreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UiSurfacePreferences>(() =>
    readUiSurfacePreferences(),
  );

  const customPaletteMap = useMemo(
    () => customPalettesToMap(preferences.customPalettes),
    [preferences.customPalettes],
  );

  const resolvePalette = useCallback(
    (paletteId: UiSurfacePaletteId) => resolveUiSurfacePalette(paletteId, customPaletteMap),
    [customPaletteMap],
  );

  const setContextPalette = useCallback(
    (contextId: UiSurfaceContextId, paletteId: UiSurfacePaletteId) => {
      setPreferences((current) => {
        const next = setPaletteForContext(current, contextId, paletteId);
        writeUiSurfacePreferences(next);
        return next;
      });
    },
    [],
  );

  const saveCustomPalette = useCallback(
    (input: { label: string; baseHex: string; hoverHex?: string }) => {
      const custom = createCustomPalette(input);
      if (!custom) {
        return null;
      }
      setPreferences((current) => {
        const next = addCustomPaletteToPreferences(current, custom);
        writeUiSurfacePreferences(next);
        return next;
      });
      return custom.id;
    },
    [],
  );

  const removeCustomPalette = useCallback((paletteId: UiSurfacePaletteId) => {
    setPreferences((current) => {
      const next = removeCustomPaletteFromPreferences(current, paletteId);
      writeUiSurfacePreferences(next);
      return next;
    });
  }, []);

  const resetContextPalette = useCallback((contextId: UiSurfaceContextId) => {
    setPreferences((current) => {
      const next = resetPaletteForContext(current, contextId);
      writeUiSurfacePreferences(next);
      return next;
    });
  }, []);

  const resetAllContextPalettesHandler = useCallback(() => {
    setPreferences((current) => {
      const next = resetAllContextPalettes(current);
      writeUiSurfacePreferences(next);
      return next;
    });
  }, []);

  const setViewLayoutForContextHandler = useCallback(
    (contextId: UiSurfaceContextId, layout: ViewLayout) => {
      setPreferences((current) => {
        const next = setViewLayoutForContext(current, contextId, layout);
        writeUiSurfacePreferences(next);
        return next;
      });
    },
    [],
  );

  const toggleViewLayoutForContextHandler = useCallback((contextId: UiSurfaceContextId) => {
    setPreferences((current) => {
      const next = toggleViewLayoutForContext(current, contextId);
      writeUiSurfacePreferences(next);
      return next;
    });
  }, []);

  const value = useMemo<UiSurfacePreferencesContextValue>(
    () => ({
      preferences,
      customPalettes: preferences.customPalettes,
      paletteForContext: (contextId) =>
        resolveUiSurfacePalette(paletteIdForContext(preferences, contextId), customPaletteMap),
      paletteIdForContext: (contextId) => paletteIdForContext(preferences, contextId),
      resolvePalette,
      setContextPalette,
      saveCustomPalette,
      removeCustomPalette,
      resetContextPalette,
      resetAllContextPalettes: resetAllContextPalettesHandler,
      viewLayoutForContext: (contextId) => viewLayoutForContext(preferences, contextId),
      setViewLayoutForContext: setViewLayoutForContextHandler,
      toggleViewLayoutForContext: toggleViewLayoutForContextHandler,
    }),
    [
      preferences,
      customPaletteMap,
      resolvePalette,
      setContextPalette,
      saveCustomPalette,
      removeCustomPalette,
      resetContextPalette,
      resetAllContextPalettesHandler,
      setViewLayoutForContextHandler,
      toggleViewLayoutForContextHandler,
    ],
  );

  return (
    <UiSurfacePreferencesContext.Provider value={value}>
      {children}
    </UiSurfacePreferencesContext.Provider>
  );
}

export function useUiSurfacePreferences() {
  const context = useContext(UiSurfacePreferencesContext);
  if (!context) {
    throw new Error("useUiSurfacePreferences must be used inside UiSurfacePreferencesProvider");
  }
  return context;
}

/** Aplica variables CSS de fila al montar la página (un listado a la vez). */
export function usePageListRowPalette(contextId: UiSurfaceContextId) {
  const { paletteForContext } = useUiSurfacePreferences();
  const palette = paletteForContext(contextId);

  useEffect(() => {
    applyListRowCssVariables(palette);
  }, [palette]);

  return palette;
}

export function usePageViewLayout(contextId: UiSurfaceContextId) {
  const { viewLayoutForContext, toggleViewLayoutForContext, setViewLayoutForContext } =
    useUiSurfacePreferences();
  const layout = viewLayoutForContext(contextId);

  return {
    layout,
    setViewLayout: (next: ViewLayout) => setViewLayoutForContext(contextId, next),
    toggleViewLayout: () => toggleViewLayoutForContext(contextId),
  };
}

export function useDefaultPersonCardPaletteId(
  contextId: "sale.senderCard" | "sale.recipientCard",
): UiSurfacePaletteId {
  const { paletteIdForContext, resolvePalette } = useUiSurfacePreferences();
  const paletteId = paletteIdForContext(contextId);
  const palette = resolvePalette(paletteId);
  return palette.personCardId ?? paletteId;
}
