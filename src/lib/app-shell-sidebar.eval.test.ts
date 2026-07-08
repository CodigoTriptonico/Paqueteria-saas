import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const appShellSource = readFileSync(
  join(process.cwd(), "src", "components", "app-shell.tsx"),
  "utf8",
);
const brandHeaderSource = readFileSync(
  join(process.cwd(), "src", "components", "notifications", "notifications-center.tsx"),
  "utf8",
);

function sourceIndex(text: string) {
  const index = appShellSource.indexOf(text);

  assert.ok(index >= 0, `Missing source marker: ${text}`);
  return index;
}

describe("app shell sidebar eval", () => {
  it("keeps sidebar grouped by operational workflow", () => {
    const trabajoIndex = sourceIndex('{ id: "main", label: "Trabajo" }');
    const enviosIndex = sourceIndex('{ id: "shipments", label: "Envíos" }');
    const stockIndex = sourceIndex('{ id: "stock", label: "Stock" }');
    const operacionIndex = sourceIndex('{ id: "operations", label: "Operación" }');
    const reportesIndex = sourceIndex('{ id: "reports", label: "Reportes" }');

    assert.ok(trabajoIndex < enviosIndex);
    assert.ok(enviosIndex < stockIndex);
    assert.ok(stockIndex < operacionIndex);
    assert.ok(operacionIndex < reportesIndex);
  });

  it("keeps nav items in scan-friendly order", () => {
    const inicioIndex = sourceIndex('{ label: "Inicio", href: "/"');
    const ventaIndex = sourceIndex('{ label: "Nueva venta", href: "/venta"');
    const seguimientoIndex = sourceIndex('{ label: "Seguimiento", href: "/envios"');
    const inventarioIndex = sourceIndex('{ label: "Inventario", href: "/inventario"');
    const logisticaIndex = sourceIndex('{ label: "Logistica", href: "/logistica"');
    const tareasIndex = sourceIndex('{ label: "Tareas conductor", href: "/conductor/tareas"');
    const estadisticasIndex = sourceIndex('{ label: "Estadisticas", href: "/estadisticas"');

    assert.ok(inicioIndex < ventaIndex);
    assert.ok(ventaIndex < seguimientoIndex);
    assert.ok(seguimientoIndex < inventarioIndex);
    assert.ok(inventarioIndex < logisticaIndex);
    assert.ok(logisticaIndex < tareasIndex);
    assert.ok(tareasIndex < estadisticasIndex);
  });

  it("renders desktop and mobile nav from the same groups", () => {
    assert.match(appShellSource, /sidebarNavGroups\.map/);
    assert.match(appShellSource, /mobileNavGroups\.map/);
    assert.match(appShellSource, /navGroupsForItems/);
  });

  it("persists desktop sidebar collapse in localStorage", () => {
    assert.match(appShellSource, /boxario:desktop-sidebar-collapsed/);
    assert.match(appShellSource, /desktopSidebarCollapsed/);
    assert.match(appShellSource, /localStorage\.setItem\(DESKTOP_SIDEBAR_COLLAPSED_KEY/);
  });

  it("uses panel toggle icons for desktop sidebar collapse", () => {
    assert.match(brandHeaderSource, /PanelLeftClose/);
    assert.match(brandHeaderSource, /PanelLeftOpen/);
    assert.match(brandHeaderSource, /sidebarToggle/);
  });

  it("keeps desktop sidebar toggle compact in the brand header", () => {
    assert.match(brandHeaderSource, /sidebarToggleButtonClass/);
    assert.match(brandHeaderSource, /h-7 w-7/);
    assert.doesNotMatch(brandHeaderSource, /border-t border-black\/45 pt-1/);
    assert.match(brandHeaderSource, /flex shrink-0 items-center gap-1\.5/);
  });

  it("renders icon rail from sidebarNavGroups when desktop sidebar is collapsed", () => {
    assert.match(appShellSource, /showDesktopRail/);
    assert.match(appShellSource, /variant=\{showDesktopRail \? "rail" : "sidebar"\}/);
    assert.match(appShellSource, /sidebarNavGroups\.map/);
  });

  it("keeps mobile nav on mobileNavGroups unchanged", () => {
    assert.match(appShellSource, /mobileNavGroups\.map/);
    assert.doesNotMatch(appShellSource, /mobileNavGroups\.map[\s\S]*showDesktopRail/);
  });

  it("embeds desktop sidebar toggle inside Boxario brand header", () => {
    assert.match(appShellSource, /sidebarToggle=\{\{/);
    assert.match(appShellSource, /onToggle: toggleDesktopSidebar/);
    assert.match(appShellSource, /railOnly=\{showDesktopRail\}/);
  });

  it("keeps compactContent independent from desktop sidebar collapse", () => {
    const compactBlockIndex = appShellSource.indexOf("navCollapsed && showCompactSidebar");
    const desktopCollapseIndex = appShellSource.indexOf("showDesktopRail");

    assert.ok(compactBlockIndex >= 0);
    assert.ok(desktopCollapseIndex >= 0);
    assert.match(
      appShellSource,
      /showDesktopRail = desktopSidebarCollapsed && !\(navCollapsed && showCompactSidebar\)/,
    );
    assert.match(appShellSource, /boxario-nav-collapsed/);
  });
});
