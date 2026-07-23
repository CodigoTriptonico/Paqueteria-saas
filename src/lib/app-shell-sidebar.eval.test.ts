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
    const ventaIndex = sourceIndex('{ label: "Nueva venta", href: "/venta"');
    const seguimientoIndex = sourceIndex('{ label: "Seguimiento y envíos", href: "/seguimiento"');
    const inventarioIndex = sourceIndex('{ label: "Inventario", href: "/inventario"');
    const logisticaIndex = sourceIndex('{ label: "Logistica", href: "/logistica"');
    const tareasIndex = sourceIndex('{ label: "Tareas conductor", href: "/conductor/tareas"');
    const estadisticasIndex = sourceIndex('{ label: "Estadisticas", href: "/estadisticas"');

    assert.ok(ventaIndex < seguimientoIndex);
    assert.ok(seguimientoIndex < inventarioIndex);
    assert.ok(inventarioIndex < logisticaIndex);
    assert.ok(logisticaIndex < tareasIndex);
    assert.ok(tareasIndex < estadisticasIndex);
    assert.doesNotMatch(appShellSource, /\{ label: "Inicio", href: "\/"/);
    assert.match(appShellSource, /\{ label: "Nueva venta", href: "\/venta", icon: CreditCard, section: "shipments"/);
  });

  it("renders desktop groups and derives the mobile more sheet from the same allowed items", () => {
    assert.match(appShellSource, /sidebarNavGroups\.map/);
    assert.match(appShellSource, /mobileMoreNavGroups\.map/);
    assert.match(appShellSource, /navGroupsForItems/);
  });

  it("persists desktop sidebar collapse in localStorage", () => {
    assert.match(appShellSource, /boxario:desktop-sidebar-collapsed/);
    assert.match(appShellSource, /desktopSidebarCollapsed/);
    assert.match(appShellSource, /localStorage\.setItem\(DESKTOP_SIDEBAR_COLLAPSED_KEY/);
  });

  it("keeps desktop navigation groups collapsed by default and saves each user's expanded groups", () => {
    assert.match(appShellSource, /SIDEBAR_GROUPS_EXPANDED_KEY_PREFIX = "boxario:sidebar-expanded-groups"/);
    assert.match(appShellSource, /function sidebarGroupsExpandedStorageKey\(session: AppSession \| null\)/);
    assert.match(appShellSource, /session\?\.userId \?\? "anonymous"/);
    assert.match(appShellSource, /const \[expandedSidebarGroups, setExpandedSidebarGroups\] = useState<NavSectionId\[\]>\(\[\]\)/);
    assert.match(appShellSource, /const canCollapse = section\.items\.length > 0/);
    assert.match(appShellSource, /function toggleSidebarGroup\(sectionId: NavSectionId\)/);
    assert.match(appShellSource, /onClick=\{canCollapse \? \(\) => toggleSidebarGroup\(section\.id\) : undefined\}/);
    assert.match(appShellSource, /aria-controls=\{canCollapse \? groupPanelId : undefined\}/);
    assert.match(appShellSource, /aria-expanded=\{canCollapse \? sectionExpanded : undefined\}/);
    assert.match(appShellSource, /inert=\{sectionCollapsed\}/);
    assert.match(appShellSource, /ChevronDown/);
    assert.match(appShellSource, /!expandedSidebarGroups\.includes\(section\.id\)/);
    assert.match(appShellSource, /localStorage\.setItem\(sidebarGroupsStorageKey/);
    assert.doesNotMatch(appShellSource, /const activeGroup =/);
  });

  it("makes group controls easier to hit and gives every workflow group its own icon", () => {
    assert.match(appShellSource, /function navSectionIcon\(sectionId: NavSectionId\): LucideIcon/);
    assert.match(appShellSource, /case "stock":\s+return Boxes/);
    assert.match(appShellSource, /const SectionIcon = navSectionIcon\(section\.id\)/);
    assert.match(appShellSource, /min-h-11 w-full items-center justify-between rounded-lg border px-2\.5/);
    assert.match(appShellSource, /<SectionIcon className="h-4 w-4"/);
    assert.match(appShellSource, /flex h-7 w-7 shrink-0 items-center justify-center rounded-md border/);
  });

  it("keeps the compact sidebar narrow and gives the warehouse flow the same row height as other groups", () => {
    assert.match(appShellSource, /showDesktopRail \? "w-16 p-2" : "w-64 p-3"/);
    assert.match(appShellSource, /const isWarehouseSection = section\.id === "warehouse"/);
    assert.match(appShellSource, /<span>Flujo<\/span>/);
    assert.match(appShellSource, /<span>de bodega<\/span>/);
    assert.doesNotMatch(appShellSource, /bg-\[#123d31\] p-2 shadow-\[/);
    assert.doesNotMatch(appShellSource, /3 PASOS/);
  });

  it("glows sidebar groups only while expanded", () => {
    assert.match(appShellSource, /const sectionExpanded = !sectionCollapsed/);
    assert.match(appShellSource, /const collapsedGroupHeaderClass =/);
    assert.match(
      appShellSource,
      /sectionExpanded \? "sidebar-group-expanded" : collapsedGroupHeaderClass/,
    );
    assert.match(appShellSource, /sectionExpanded\s+\? "sidebar-group-expanded-icon"/);
    assert.match(appShellSource, /sectionExpanded\s+\? "sidebar-group-expanded-chevron"/);
    assert.doesNotMatch(appShellSource, /border-emerald-700\/75 bg-\[#163c30\]/);
    assert.doesNotMatch(appShellSource, /sectionHasActiveItem/);
    assert.match(
      readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8"),
      /\.sidebar-group-expanded \{/,
    );
  });

  it("makes the current page unmistakable inside its expanded group", () => {
    assert.doesNotMatch(appShellSource, /function sidebarNavItemClass\(/);
    assert.doesNotMatch(appShellSource, /groupExpanded/);
    assert.match(appShellSource, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(appShellSource, /sidebar-nav-item-active border-black\/90 bg-\[#243a32\] text-white/);
    assert.match(appShellSource, /sidebar-nav-active-dot/);
    assert.match(appShellSource, /ml-3 grid gap-1 border-l border-black\/70 pl-2/);
    assert.doesNotMatch(appShellSource, /flowStep/);
    assert.match(
      readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8"),
      /\.sidebar-nav-item-active \{/,
    );
  });

  it("toggles every sidebar group from the brand header control", () => {
    assert.match(appShellSource, /const collapsibleSidebarGroupIds = useMemo/);
    assert.match(appShellSource, /const allSidebarGroupsExpanded = useMemo/);
    assert.match(appShellSource, /function toggleAllSidebarGroups\(\)/);
    assert.match(appShellSource, /sidebarGroupsToggle=\{\{/);
    assert.match(appShellSource, /allExpanded: allSidebarGroupsExpanded/);
    assert.match(appShellSource, /onToggle: toggleAllSidebarGroups/);
    assert.match(brandHeaderSource, /sidebarGroupsToggle\?: \{/);
    assert.match(brandHeaderSource, /ChevronsDownUp/);
    assert.match(brandHeaderSource, /Expandir todos los grupos del menú/);
    assert.match(brandHeaderSource, /Contraer todos los grupos del menú/);
  });

  it("groups sidebar collapse with page surface controls in the footer", () => {
    assert.match(brandHeaderSource, /export function SidebarCollapseButton/);
    assert.match(brandHeaderSource, /PanelLeftClose/);
    assert.match(brandHeaderSource, /PanelLeftOpen/);
    assert.match(appShellSource, /<SidebarFooterControls/);
    assert.match(appShellSource, /onToggleSidebar=\{toggleDesktopSidebar\}/);
    assert.match(appShellSource, /sidebarCollapsed=\{showDesktopRail\}/);
  });

  it("keeps notifications in the brand header when expanded and in rail top when collapsed", () => {
    assert.match(
      brandHeaderSource,
      /\{showNotifications \? <NotificationsCenter session=\{session\} variant="brand" \/> : null\}/,
    );
    assert.match(appShellSource, /showDesktopRail \? \([\s\S]*NotificationsCenter session=\{session\} variant="brand"/);
    assert.doesNotMatch(brandHeaderSource, /sidebarToggle/);
  });

  it("gives the brand header a darker surface and readable icon wells", () => {
    assert.match(brandHeaderSource, /bg-surface-card-header/);
    assert.match(brandHeaderSource, /bg-surface-inset/);
    assert.doesNotMatch(brandHeaderSource, /w-1 bg-emerald-400\/80/);
    assert.doesNotMatch(appShellSource, /rounded-r-full bg-emerald-300/);
    assert.doesNotMatch(brandHeaderSource, /<Package className=/);
    assert.doesNotMatch(brandHeaderSource, /bg-surface-card text-\[#f8fafc\] shadow-sm/);
  });

  it("keeps the brand header to one compact operational row", () => {
    assert.match(brandHeaderSource, /flex h-12 items-center overflow-visible/);
    assert.match(brandHeaderSource, /ml-1 flex h-8 shrink-0 items-center gap-1/);
    assert.match(brandHeaderSource, /const showContextBack = Boolean\(onBack\)/);
    assert.doesNotMatch(brandHeaderSource, /h-\[5\.25rem\]/);
    assert.doesNotMatch(brandHeaderSource, /mt-auto flex h-8/);
  });

  it("renders icon rail from sidebarNavGroups when desktop sidebar is collapsed", () => {
    assert.match(appShellSource, /showDesktopRail/);
    assert.match(appShellSource, /variant=\{showDesktopRail \? "rail" : "sidebar"\}/);
    assert.match(appShellSource, /sidebarNavGroups\.map/);
  });

  it("keeps the mobile more sheet separate from desktop rail behavior and makes its groups collapsible", () => {
    assert.match(appShellSource, /mobileMoreNavGroups\.map/);
    assert.doesNotMatch(appShellSource, /mobileMoreNavGroups\.map[\s\S]*showDesktopRail/);
    assert.match(appShellSource, /mobile-more-group-\$\{section\.id\}/);
    assert.match(appShellSource, /mobileMoreNavGroups\.map[\s\S]*toggleSidebarGroup\(section\.id\)/);
    assert.match(appShellSource, /mobileMoreNavGroups\.map[\s\S]*expandedSidebarGroups\.includes\(section\.id\)/);
  });

  it("places desktop sidebar toggle in the grouped footer controls", () => {
    assert.match(appShellSource, /onToggleSidebar=\{toggleDesktopSidebar\}/);
    assert.match(appShellSource, /variant=\{showDesktopRail \? "rail" : "sidebar"\}/);
    assert.match(brandHeaderSource, /export function SidebarCollapseButton/);
    assert.doesNotMatch(appShellSource, /sidebarToggle=\{\{/);
    assert.doesNotMatch(appShellSource, /railOnly=/);
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
