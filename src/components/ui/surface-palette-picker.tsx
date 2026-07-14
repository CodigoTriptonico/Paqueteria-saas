"use client";

import { Droplet, Palette, RotateCcw, Sparkles, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { listRowBaseClass, listRowHoverClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useUiSurfacePreferences } from "@/components/ui/ui-surface-preferences-provider";
import { resolveSalePersonCardVariant } from "@/components/sale/sale-person-card-variants";
import {
  buildCustomUiSurfacePalette,
  isCustomPaletteId,
} from "@/lib/ui-surface-custom-palettes";
import { defaultHoverHex, normalizeHex } from "@/lib/ui-surface-color-math";
import { uiSurfaceContextMeta, type UiSurfaceContextId, type UiSurfaceContextKind } from "@/lib/ui-surface-context";
import {
  uiSurfacePalettesForKind,
  type UiSurfacePalette,
  type UiSurfacePaletteId,
} from "@/lib/ui-surface-palettes";
import {
  paletteIdsForTheme,
  UI_SURFACE_THEME_GROUPS,
  type UiSurfaceThemeId,
} from "@/lib/ui-surface-themes";

export type SurfacePalettePickerProps = {
  mode: UiSurfaceContextKind;
  currentId: UiSurfacePaletteId;
  onSelect: (paletteId: UiSurfacePaletteId) => void;
  onClose: () => void;
  x?: number;
  y?: number;
  inline?: boolean;
  title?: string;
  contextId?: UiSurfaceContextId;
  anchorRef?: RefObject<HTMLElement | null>;
  dismissOnOutsideClick?: boolean;
};

type PickerTab = "themes" | "colors" | "custom";

const QUICK_PICK_HEXES = [
  "#1e4a9e",
  "#0f7a52",
  "#6b2fc4",
  "#a83252",
  "#b84a14",
  "#2c3440",
  "#3d3428",
  "#121212",
  "#0a6e94",
  "#9a2d7a",
  "#4a8a14",
  "#322a3e",
];

export function SurfacePalettePicker({
  mode,
  currentId,
  onSelect,
  onClose,
  x,
  y,
  inline = false,
  title,
  contextId,
  anchorRef,
  dismissOnOutsideClick,
}: SurfacePalettePickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    customPalettes,
    resolvePalette,
    saveCustomPalette,
    removeCustomPalette,
    resetContextPalette,
    resetAllContextPalettes,
  } = useUiSurfacePreferences();
  const [tab, setTab] = useState<PickerTab>("themes");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [themeId, setThemeId] = useState<UiSurfaceThemeId>("vivid");
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("Mi color");
  const [customBase, setCustomBase] = useState("#2c3440");
  const [customHover, setCustomHover] = useState("#343d4d");
  const [autoHover, setAutoHover] = useState(true);

  const catalogPalettes = useMemo(() => uiSurfacePalettesForKind(mode), [mode]);
  const catalogIds = useMemo(() => catalogPalettes.map((palette) => palette.id), [catalogPalettes]);
  const customBuilt = useMemo(
    () => customPalettes.map((entry) => buildCustomUiSurfacePalette(entry)),
    [customPalettes],
  );

  const allPalettes = useMemo(() => {
    const byId = new Map<string, UiSurfacePalette>();
    for (const palette of catalogPalettes) {
      byId.set(palette.id, palette);
    }
    for (const palette of customBuilt) {
      byId.set(palette.id, palette);
    }
    return [...byId.values()];
  }, [catalogPalettes, customBuilt]);

  const currentPalette = resolvePalette(currentId);
  const pageLabel = contextId ? uiSurfaceContextMeta(contextId).label : title ?? "esta página";

  const themedIds = useMemo(
    () => paletteIdsForTheme(themeId, catalogIds),
    [themeId, catalogIds],
  );

  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const pool = tab === "themes" ? themedIds : catalogIds;
    return allPalettes.filter((palette) => {
      if (!pool.includes(palette.id) && !isCustomPaletteId(palette.id)) {
        return false;
      }
      if (tab === "custom" && !isCustomPaletteId(palette.id)) {
        return false;
      }
      if (tab === "colors" && isCustomPaletteId(palette.id)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        palette.label.toLowerCase().includes(normalized) ||
        palette.id.toLowerCase().includes(normalized) ||
        palette.listRow.hex.includes(normalized)
      );
    });
  }, [allPalettes, tab, themedIds, catalogIds, query]);

  useEffect(() => {
    const shouldDismiss = dismissOnOutsideClick ?? !inline;
    if (!shouldDismiss) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (resetDialogOpen) {
        return;
      }
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (anchorRef?.current?.contains(target)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (resetDialogOpen) {
          setResetDialogOpen(false);
          return;
        }
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, dismissOnOutsideClick, inline, onClose, resetDialogOpen]);

  const panelWidth = inline ? undefined : 340;
  const panelHeight = 520;
  const left =
    x === undefined ? undefined : Math.min(Math.max(12, x), window.innerWidth - (panelWidth ?? 340) - 12);
  const top =
    y === undefined ? undefined : Math.min(Math.max(12, y), window.innerHeight - panelHeight - 12);

  const shellClass = inline
    ? "w-full rounded-xl border border-black bg-surface-panel p-3"
    : "fixed z-[140] w-[21.25rem] rounded-xl border border-black bg-surface-panel p-3 shadow-2xl";

  function pick(paletteId: UiSurfacePaletteId) {
    onSelect(paletteId);
    if (!inline) {
      onClose();
    }
  }

  function handleSaveCustom() {
    const id = saveCustomPalette({
      label: customName,
      baseHex: customBase,
      hoverHex: autoHover ? undefined : customHover,
    });
    if (id) {
      pick(id);
    }
  }

  function handleResetPage() {
    if (!contextId) {
      return;
    }
    resetContextPalette(contextId);
    setResetDialogOpen(false);
  }

  function handleResetAll() {
    resetAllContextPalettes();
    setResetDialogOpen(false);
  }

  return (
    <>
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title ?? "Elegir paleta de color"}
      className={shellClass}
      style={inline ? undefined : { left, top, width: panelWidth }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            <Palette className="h-3.5 w-3.5" aria-hidden />
            {title ?? (mode === "personCard" ? "Color de tarjeta" : "Color de filas")}
          </p>
          <p className="mt-0.5 truncate text-sm font-black text-[#f8fafc]">{currentPalette.label}</p>
        </div>
        <span className="rounded-md border border-black bg-surface-inset px-2 py-1 text-[10px] font-black tabular-nums text-slate-400">
          {currentPalette.listRow.hex}
        </span>
      </div>

      <LivePreview palette={currentPalette} mode={mode} />

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-black bg-surface-inset p-1">
        {(
          [
            ["themes", "Temas"],
            ["colors", "Colores"],
            ["custom", "Personal"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-2 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
              tab === id
                ? "bg-emerald-400/15 text-emerald-200"
                : "text-slate-500 hover:bg-surface-card hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "themes" ? (
        <div className="mt-2 grid max-h-[7.5rem] grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
          {UI_SURFACE_THEME_GROUPS.filter((theme) => theme.id !== "all").map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              className={`relative overflow-hidden rounded-lg border px-2 py-2 text-left transition ${
                themeId === theme.id
                  ? "border-emerald-600 bg-emerald-400/10"
                  : "border-black bg-surface-inset hover:bg-surface-card"
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-35 ${theme.gradient}`}
                aria-hidden
              />
              <span className="relative flex items-center gap-1 text-[10px] font-black uppercase text-slate-300">
                <Sparkles className="h-3 w-3 text-emerald-300" aria-hidden />
                {theme.label}
              </span>
              <span className="relative mt-0.5 block text-[9px] font-bold leading-tight text-slate-500">
                {theme.paletteIds.length} tonos
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {tab === "custom" ? (
        <div className="mt-2 space-y-2 rounded-lg border border-black bg-surface-inset/60 p-2.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Crear color</p>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Base
              <input
                type="color"
                value={normalizeHex(customBase) ?? "#2c3440"}
                onChange={(event) => setCustomBase(event.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-black bg-transparent p-0.5"
              />
            </label>
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Nombre
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                className="h-10 rounded-lg border border-black bg-surface-inset px-2 text-sm font-bold text-[#f8fafc] outline-none"
                placeholder="Mi color"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <input
                type="checkbox"
                checked={autoHover}
                onChange={(event) => {
                  const nextAutoHover = event.target.checked;
                  setAutoHover(nextAutoHover);
                  if (!nextAutoHover) {
                    setCustomHover(defaultHoverHex(customBase));
                  }
                }}
                className="rounded border-black"
              />
              Hover automático
            </label>
            {!autoHover ? (
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500">
                Hover
                <input
                  type="color"
                  value={normalizeHex(customHover) ?? "#343d4d"}
                  onChange={(event) => setCustomHover(event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-black bg-transparent p-0.5"
                />
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_PICK_HEXES.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => setCustomBase(hex)}
                className={`h-6 w-6 rounded-md border ${
                  normalizeHex(customBase) === hex ? "border-emerald-400" : "border-black/60"
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <button type="button" className={`${primaryButtonClass} h-9 w-full text-xs`} onClick={handleSaveCustom}>
            <Droplet className="h-3.5 w-3.5" />
            Guardar y aplicar
          </button>
        </div>
      ) : null}

      {tab !== "custom" ? (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar color o hex…"
          className="mt-2 h-9 w-full rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-bold text-[#f8fafc] outline-none"
        />
      ) : null}

      <div className="mt-2 grid max-h-[14rem] grid-cols-3 gap-2 overflow-y-auto pr-0.5">
        {(tab === "custom" ? customBuilt : filteredCatalog).map((palette) => (
          <PaletteSwatch
            key={palette.id}
            palette={palette}
            mode={mode}
            selected={palette.id === currentId}
            onSelect={() => pick(palette.id)}
            onDelete={
              isCustomPaletteId(palette.id)
                ? () => removeCustomPalette(palette.id)
                : undefined
            }
          />
        ))}
        {tab === "custom" && !customBuilt.length ? (
          <p className="col-span-3 py-4 text-center text-xs font-bold text-slate-500">
            Aún no tienes colores guardados. Arriba puedes crear el primero.
          </p>
        ) : null}
      </div>

      {contextId ? (
        <button
          type="button"
          className={`${secondaryButtonClass} mt-3 flex h-9 w-full items-center justify-center gap-1.5 text-xs font-black text-slate-300`}
          onClick={() => setResetDialogOpen(true)}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Restablecer colores
        </button>
      ) : null}
    </div>

    {contextId ? (
      <SurfacePaletteResetDialog
        open={resetDialogOpen}
        pageLabel={pageLabel}
        onCancel={() => setResetDialogOpen(false)}
        onResetPage={handleResetPage}
        onResetAll={handleResetAll}
      />
    ) : null}
    </>
  );
}

function SurfacePaletteResetDialog({
  open,
  pageLabel,
  onCancel,
  onResetPage,
  onResetAll,
}: {
  open: boolean;
  pageLabel: string;
  onCancel: () => void;
  onResetPage: () => void;
  onResetAll: () => void;
}) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="app-modal-overlay fixed inset-0 z-[260] flex justify-center bg-black/70 p-3 sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="surface-palette-reset-title"
        className="app-modal-content relative w-full max-w-sm rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p id="surface-palette-reset-title" className="text-lg font-black text-[#f8fafc]">
          Restablecer colores
        </p>
        <p className="mt-2 text-sm font-bold leading-snug text-slate-400">
          ¿Volver a los colores por defecto solo en{" "}
          <span className="text-slate-200">{pageLabel}</span> o en todas las pantallas?
        </p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onResetPage}
            className={`${primaryButtonClass} h-10 w-full text-xs`}
          >
            Solo esta página
          </button>
          <button
            type="button"
            onClick={onResetAll}
            className="h-10 w-full rounded-lg border border-amber-700/60 bg-amber-950/50 text-xs font-black text-amber-100 transition hover:bg-amber-900/50"
          >
            Todas las páginas
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`${secondaryButtonClass} h-10 w-full text-xs font-black`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LivePreview({
  palette,
  mode,
}: {
  palette: UiSurfacePalette;
  mode: UiSurfaceContextKind;
}) {
  const personVariant = palette.personCardId
    ? resolveSalePersonCardVariant(palette.personCardId)
    : null;

  if (mode === "personCard" && personVariant) {
    return (
      <div className={`${personVariant.card} px-3 py-2.5`}>
        <p className={`text-sm font-black ${personVariant.name}`}>Vista previa</p>
        <p className={`text-xs font-bold ${personVariant.phone}`}>Cliente demo · 555-0100</p>
      </div>
    );
  }

  return (
    <div
      className={`${listRowBaseClass} ${listRowHoverClass} px-3 py-2`}
      style={{
        backgroundColor: palette.listRow.hex,
        borderColor: "rgba(0,0,0,0.45)",
      }}
    >
      <p className="text-sm font-black text-[#f8fafc]">INV-000 · Fila de ejemplo</p>
      <p className="text-[10px] font-bold text-slate-300">Así se verán tus listados</p>
    </div>
  );
}

function PaletteSwatch({
  palette,
  mode,
  selected,
  onSelect,
  onDelete,
}: {
  palette: UiSurfacePalette;
  mode: UiSurfaceContextKind;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const personVariant = palette.personCardId
    ? resolveSalePersonCardVariant(palette.personCardId)
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        title={`${palette.label} · ${palette.listRow.hex}`}
        onClick={onSelect}
        className={`flex w-full flex-col items-center gap-1 rounded-lg border p-2 transition hover:bg-surface-card ${
          selected ? "border-emerald-500 bg-emerald-400/10 ring-1 ring-emerald-500/40" : "border-black bg-surface-inset"
        }`}
      >
        <span
          className={`flex h-10 w-full items-center justify-center rounded-md border border-black/50 shadow-inner ${
            mode === "personCard" && personVariant ? personVariant.swatch : ""
          }`}
          style={
            mode === "personCard" && personVariant
              ? undefined
              : { backgroundColor: palette.listRow.hex }
          }
        >
          {mode === "personCard" ? (
            <User className="h-3.5 w-3.5 text-slate-950/80" aria-hidden />
          ) : null}
        </span>
        <span className="w-full truncate text-center text-[9px] font-black text-[#f8fafc]">{palette.label}</span>
      </button>
      {onDelete ? (
        <button
          type="button"
          aria-label={`Eliminar ${palette.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className={`${secondaryButtonClass} absolute -right-1 -top-1 h-6 w-6 rounded-full p-0 text-rose-300`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
