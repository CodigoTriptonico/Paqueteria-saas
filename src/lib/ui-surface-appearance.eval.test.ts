import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("ui surface appearance eval", () => {
  it("exposes per-context palette pickers in configuration", () => {
    const panel = read("components/config/appearance-settings-panel.tsx");
    assert.equal(panel.includes("AppearanceSettingsPanel"), true);
    assert.equal(panel.includes("UI_SURFACE_CONTEXTS"), true);
    assert.equal(panel.includes("contextId={context.id}"), true);
    assert.equal(panel.includes("Colores por pantalla"), true);
  });

  it("wires sidebar palette and view layout controls resolved per route", () => {
    const shell = read("components/app-shell.tsx");
    const frame = read("components/app-frame.tsx");
    const routeContext = read("lib/ui-surface-route-context.ts");
    const picker = read("components/ui/surface-palette-picker.tsx");
    const sidebarControls = read("components/ui/sidebar-page-surface-controls.tsx");

    assert.equal(shell.includes("SidebarFooterControls"), true);
    assert.equal(sidebarControls.includes("SidebarCollapseButton"), true);
    assert.equal(sidebarControls.includes("ViewLayoutToggle"), true);
    assert.equal(sidebarControls.includes("Color de página"), false);
    assert.equal(frame.includes("resolveSurfaceContextFromPathname"), true);
    assert.equal(frame.includes("surfaceContextId"), true);
    assert.equal(routeContext.includes("logistics.tasks"), true);
    assert.equal(routeContext.includes("shipments.tracking"), true);
    assert.equal(picker.includes("UI_SURFACE_THEME_GROUPS"), true);
    assert.equal(picker.includes("saveCustomPalette"), true);
  });

  it("does not duplicate palette controls inside page toolbars", () => {
    const pages = [
      "components/logistica-client.tsx",
      "components/envios-client.tsx",
      "components/conductor/conductor-tareas-client.tsx",
      "components/estadisticas/ventas-panel.tsx",
      "components/time-clock/time-clock-admin-client.tsx",
    ];

    for (const page of pages) {
      const source = read(page);
      assert.equal(source.includes("SurfaceContextColorTrigger"), false, page);
      assert.equal(source.includes("usePageListRowPalette"), false, page);
    }
  });

  it("uses sale sender and recipient contexts for venta via shell override", () => {
    const venta = read("components/venta-client.tsx");
    assert.equal(venta.includes("surfaceContextId: saleListPaletteContext"), true);
    assert.equal(venta.includes('"sale.senderCard"'), true);
    assert.equal(venta.includes('"sale.recipientCard"'), true);
    assert.equal(venta.includes("usePageListRowPalette"), false);
    assert.equal(venta.includes("usePageViewLayout(saleListPaletteContext)"), true);
  });

  it("applies page palette tint to venta card mode", () => {
    const senderList = read("components/sale/sale-sender-list.tsx");
    const recipientList = read("components/sale/sale-recipient-list.tsx");
    const personCard = read("components/sale/sale-person-card.tsx");

    assert.equal(senderList.includes("pageSurfaceTint"), true);
    assert.equal(recipientList.includes("pageSurfaceTint"), true);
    assert.equal(personCard.includes("listCardShellClass"), true);
  });

  it("closes inline palette popovers on outside click", () => {
    const picker = read("components/ui/surface-palette-picker.tsx");
    const sidebarControls = read("components/ui/sidebar-page-surface-controls.tsx");

    assert.equal(picker.includes("dismissOnOutsideClick"), true);
    assert.equal(picker.includes("anchorRef"), true);
    assert.equal(sidebarControls.includes("dismissOnOutsideClick"), true);
    assert.equal(sidebarControls.includes("anchorRef={paletteTriggerRef}"), true);
  });

  it("stacks footer icon controls vertically when the sidebar is collapsed", () => {
    const sidebarControls = read("components/ui/sidebar-page-surface-controls.tsx");

    assert.match(sidebarControls, /variant === "rail"[\s\S]*flex-col items-center/);
  });

  it("opens the palette popover upward from the footer trigger", () => {
    const sidebarControls = read("components/ui/sidebar-page-surface-controls.tsx");

    assert.match(sidebarControls, /left-full bottom-0/);
    assert.match(sidebarControls, /max-h-\[min\(32rem,calc\(100dvh-1\.5rem\)\)\]/);
  });

  it("offers reset with page-only or all-pages confirmation", () => {
    const picker = read("components/ui/surface-palette-picker.tsx");
    const provider = read("components/ui/ui-surface-preferences-provider.tsx");

    assert.match(picker, /Restablecer colores/);
    assert.match(picker, /Solo esta página/);
    assert.match(picker, /Todas las páginas/);
    assert.match(provider, /resetContextPalette/);
    assert.match(provider, /resetAllContextPalettes/);
  });
});
