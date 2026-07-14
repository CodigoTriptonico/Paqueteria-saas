"use client";

import { Palette } from "lucide-react";
import { useRef, useState } from "react";
import { SidebarCollapseButton } from "@/components/notifications/notifications-center";
import { ViewLayoutToggle } from "@/components/view-layout-toggle";
import { SurfacePalettePicker } from "@/components/ui/surface-palette-picker";
import {
  usePageViewLayout,
  usePageListRowPalette,
  useUiSurfacePreferences,
} from "@/components/ui/ui-surface-preferences-provider";
import {
  surfaceContextSupportsViewLayout,
  uiSurfaceContextMeta,
  type UiSurfaceContextId,
} from "@/lib/ui-surface-context";

type SidebarControlsVariant = "sidebar" | "rail" | "bar";

const iconButtonClass = {
  sidebar:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-400 transition hover:bg-[#2f3834] hover:text-slate-200 active:scale-[0.98]",
  rail: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-400 transition hover:bg-[#2f3834] hover:text-slate-200 active:scale-[0.98]",
  bar: "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-400 transition hover:bg-[#2f3834] hover:text-slate-200 active:scale-[0.98]",
};

function footerRowClass(variant: SidebarControlsVariant) {
  const isRail = variant === "rail";
  const isBar = variant === "bar";

  if (isRail) {
    return "mb-2 flex w-full flex-col items-center gap-1";
  }

  if (isBar) {
    return "flex shrink-0 gap-1";
  }

  return "mb-2 flex w-full gap-1";
}

function SidebarPageSurfaceControlsContent({
  contextId,
  variant,
}: {
  contextId: UiSurfaceContextId;
  variant: SidebarControlsVariant;
}) {
  const meta = uiSurfaceContextMeta(contextId);
  const { paletteIdForContext, setContextPalette } = useUiSurfacePreferences();
  const { layout, toggleViewLayout } = usePageViewLayout(contextId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteTriggerRef = useRef<HTMLButtonElement>(null);
  const currentId = paletteIdForContext(contextId);
  const supportsLayout = surfaceContextSupportsViewLayout(contextId);

  usePageListRowPalette(contextId);

  const isBar = variant === "bar";

  const pickerPositionClass = isBar
    ? "right-0 top-full z-[200] mt-2"
    : "left-full bottom-0 z-[200] ml-2 max-h-[min(32rem,calc(100dvh-1.5rem))] overflow-y-auto";

  return (
    <>
      {supportsLayout ? (
        <ViewLayoutToggle
          layout={layout}
          onToggle={toggleViewLayout}
          variant={variant === "bar" ? "sidebar" : variant}
        />
      ) : null}
      <div className={`relative ${supportsLayout ? "" : "w-full"}`}>
        <button
          ref={paletteTriggerRef}
          type="button"
          className={`${iconButtonClass[variant]}${supportsLayout ? "" : " w-full"}`}
          aria-expanded={paletteOpen}
          aria-label={`Color de ${meta.label}`}
          title={`Color de ${meta.label}`}
          onClick={() => setPaletteOpen((value) => !value)}
        >
          <Palette className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        </button>
        {paletteOpen ? (
          <div className={`absolute ${pickerPositionClass} w-[21.25rem] max-w-[calc(100vw-1.5rem)]`}>
            <SurfacePalettePicker
              mode={meta.kind}
              currentId={currentId}
              contextId={contextId}
              title={meta.label}
              inline
              anchorRef={paletteTriggerRef}
              dismissOnOutsideClick
              onSelect={(paletteId) => setContextPalette(contextId, paletteId)}
              onClose={() => setPaletteOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

type SidebarPageSurfaceControlsProps = {
  contextId: UiSurfaceContextId;
  variant?: SidebarControlsVariant;
};

/** Controles de paleta y vista para la barra móvil superior. */
export function SidebarPageSurfaceControls({
  contextId,
  variant = "sidebar",
}: SidebarPageSurfaceControlsProps) {
  return (
    <div className={footerRowClass(variant)}>
      <SidebarPageSurfaceControlsContent contextId={contextId} variant={variant} />
    </div>
  );
}

type SidebarFooterControlsProps = {
  contextId?: UiSurfaceContextId | null;
  variant?: "sidebar" | "rail";
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

/** Footer del sidebar: vista, paleta y ocultar panel en una sola fila de iconos. */
export function SidebarFooterControls({
  contextId,
  variant = "sidebar",
  sidebarCollapsed,
  onToggleSidebar,
}: SidebarFooterControlsProps) {
  return (
    <div className={footerRowClass(variant)}>
      {contextId ? (
        <SidebarPageSurfaceControlsContent contextId={contextId} variant={variant} />
      ) : null}
      <SidebarCollapseButton
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
      />
    </div>
  );
}
