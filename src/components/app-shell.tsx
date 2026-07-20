"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Box,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  History,
  House,
  ListTodo,
  LucideIcon,
  MoreHorizontal,
  PackageCheck,
  Settings,
  Shield,
  Truck,
  Users,
  Layers3,
  Landmark,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UserAccountMenu } from "@/components/user-account-menu";
import { SidebarFooterControls, SidebarPageSurfaceControls } from "@/components/ui/sidebar-page-surface-controls";
import { OnboardingCoachSidebarCountdown } from "@/components/onboarding/onboarding-coach-countdown";
import { BoxarioBrandHeader, NotificationsCenter } from "@/components/notifications/notifications-center";
import { canAccessPath, isPlatformOnlySession } from "@/lib/auth/permissions";
import { conductorTasksNavLabel } from "@/lib/conductor-tareas-view";
import { ONBOARDING_TARGETS } from "@/lib/onboarding/coach-targets";
import { resolveOrganizationBrandingFromSession } from "@/lib/organizations/branding";
import type { UiSurfaceContextId } from "@/lib/ui-surface-context";
import type { AppSession } from "@/lib/auth/types";

type NavSectionId = "main" | "shipments" | "agencies" | "stock" | "warehouse" | "operations" | "finance" | "reports" | "admin";

const navSections: { id: NavSectionId; label: string }[] = [
  { id: "main", label: "Trabajo" },
  { id: "shipments", label: "Envíos" },
  { id: "agencies", label: "Agencias" },
  { id: "stock", label: "Stock" },
  { id: "warehouse", label: "Flujo de bodega" },
  { id: "operations", label: "Operación" },
  { id: "finance", label: "Dinero" },
  { id: "reports", label: "Reportes" },
  { id: "admin", label: "Admin" },
];

const navItems: {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSectionId;
  flowStep?: string;
  hasSubmenu?: boolean;
  platformOnly?: boolean;
}[] = [
  { label: "Nueva venta", href: "/venta", icon: CreditCard, section: "shipments", hasSubmenu: true },
  { label: "Mi agencia", href: "/agencia", icon: Building2, section: "agencies" },
  { label: "Solicitudes", href: "/solicitudes", icon: ClipboardList, section: "agencies" },
  { label: "Vendedores y agencias", href: "/agencias", icon: Building2, section: "agencies" },
  { label: "Agencias a mi cargo", href: "/captacion", icon: Users, section: "agencies" },
  { label: "Seguimiento", href: "/seguimiento", icon: ClipboardList, section: "shipments" },
  { label: "Historial envíos", href: "/seguimiento/historial", icon: History, section: "shipments" },
  { label: "Inventario", href: "/inventario", icon: Boxes, section: "stock", hasSubmenu: true },
  { label: "Ingreso a bodega", href: "/ingreso-bodega", icon: Box, section: "warehouse", flowStep: "01" },
  { label: "Bodega", href: "/bodega", icon: PackageCheck, section: "warehouse", flowStep: "02" },
  { label: "Paletas", href: "/paletas", icon: Layers3, section: "warehouse", flowStep: "03" },
  { label: "Logistica", href: "/logistica", icon: Truck, section: "operations" },
  { label: "Tareas conductor", href: "/conductor/tareas", icon: ListTodo, section: "operations" },
  { label: "Inventario camion", href: "/conductor/inventario-camion", icon: Boxes, section: "operations" },
  { label: "Contabilidad", href: "/contabilidad", icon: Landmark, section: "finance" },
  { label: "Estadisticas", href: "/estadisticas", icon: BarChart3, section: "reports" },
  { label: "Auditoria", href: "/auditoria", icon: History, section: "reports" },
  { label: "Configuracion", href: "/configuracion", icon: Settings, section: "admin" },
  { label: "Plataforma", href: "/platform", icon: Shield, section: "admin", platformOnly: true },
];

const DESKTOP_SIDEBAR_COLLAPSED_KEY = "boxario:desktop-sidebar-collapsed";
const SIDEBAR_GROUPS_EXPANDED_KEY_PREFIX = "boxario:sidebar-expanded-groups";

type AppShellProps = {
  active: string;
  title: string;
  kicker?: string;
  action?: string;
  actionHref?: string;
  secondaryAction?: string;
  secondaryActionHref?: string;
  onActiveClick?: () => void;
  compactContent?: React.ReactNode;
  compactNavLabel?: string;
  compactNavFocusKey?: string | number;
  onCompactNavClick?: () => void;
  hideCompactNavHeader?: boolean;
  compactNavSettingsHref?: string;
  contextNavLabel?: string;
  onContextNavBack?: () => void;
  contextNavTarget?: string;
  contextNavKeepBrand?: boolean;
  contentEdgeToEdge?: boolean;
  surfaceContextId?: UiSurfaceContextId | null;
  children: React.ReactNode;
};

function hasCompactSidebarContent(content: React.ReactNode) {
  return content !== null && content !== undefined && content !== false;
}

function shellBrandTitle(active: string, contextNavLabel: string | undefined, brandTitle: string) {
  if (!contextNavLabel) {
    return brandTitle;
  }

  return contextNavLabel === active ? brandTitle : contextNavLabel;
}

type CompactNavHeaderProps = {
  compact?: boolean;
  compactNavTitle: string;
  compactNavBackTitle: string;
  onCompactNavClick: () => void;
  compactNavSettingsHref?: string;
};

function CompactNavHeader({
  compact,
  compactNavTitle,
  compactNavBackTitle,
  onCompactNavClick,
  compactNavSettingsHref,
}: CompactNavHeaderProps) {
  const buttonClass = compact
    ? "flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-black bg-surface-card px-3 text-sm font-black text-slate-200 transition-all duration-200 active:scale-[0.98] hover:bg-[#2f3834]"
    : "flex h-14 min-w-0 flex-1 items-center gap-3 rounded-lg border border-black bg-surface-card px-4 text-left text-lg font-black text-slate-200 transition-all duration-200 hover:-translate-x-0.5 hover:bg-[#2f3834]";
  const settingsClass = compact
    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-300 transition-all duration-200 active:scale-[0.98] hover:bg-[#2f3834] hover:text-slate-100"
    : "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-300 transition-all duration-200 hover:bg-[#2f3834] hover:text-slate-100";

  return (
    <div className="flex gap-2">
      <button
        onClick={onCompactNavClick}
        className={buttonClass}
        title={compactNavBackTitle}
      >
        <ArrowLeft className={compact ? "h-5 w-5 shrink-0" : "h-6 w-6 shrink-0"} />
        <span className="min-w-0 flex-1 truncate text-left">{compactNavTitle}</span>
      </button>
      {compactNavSettingsHref ? (
        <Link
          href={compactNavSettingsHref}
          className={settingsClass}
          title="Configuracion"
          aria-label="Configuracion"
        >
          <Settings className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </Link>
      ) : null}
    </div>
  );
}

type NavItemDef = (typeof navItems)[number];

function navItemLabel(item: NavItemDef, session: AppSession | null) {
  if (item.href === "/conductor/tareas" && session) {
    return conductorTasksNavLabel(session.roleSlug);
  }

  return item.label;
}

function navItemsForSession(session: AppSession | null) {
  if (!session) {
    return [];
  }

  const isPlatformOnly = isPlatformOnlySession(session);

  return navItems.filter((item) => {
    if (isPlatformOnly) {
      return Boolean(item.platformOnly);
    }
    if (item.platformOnly) {
      return false;
    }
    return canAccessPath(session, item.href);
  });
}

function navSectionIdForItem(item: NavItemDef): NavSectionId {
  if (item.section) {
    return item.section;
  }

  if (item.href.startsWith("/seguimiento")) {
    return "shipments";
  }

  return "main";
}

function navGroupsForItems(items: NavItemDef[]) {
  return navSections
    .map((section) => ({
      ...section,
      items: items.filter((item) => navSectionIdForItem(item) === section.id),
    }))
    .filter((section) => section.items.length > 0);
}

function mobilePrimaryNavItems(session: AppSession | null, items: NavItemDef[]) {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const preferred =
    session?.roleSlug === "conductor"
      ? ["/conductor/tareas", "/conductor/inventario-camion"]
      : session?.roleSlug === "distribuidor"
        ? ["/agencia", "/solicitudes"]
        : ["administrador_agencia", "vendedor_agencia", "caja_agencia", "operador_agencia"].includes(session?.roleSlug || "")
          ? ["/agencia", "/solicitudes"]
          : ["captador_distribuidores", "captador_agencias", "supervisor_agencias"].includes(session?.roleSlug || "")
            ? ["/captacion", "/agencias"]
            : session?.roleSlug === "finanzas"
              ? ["/contabilidad", "/agencias"]
              : ["/venta", "/seguimiento"];

  return preferred.map((href) => byHref.get(href)).filter((item): item is NavItemDef => Boolean(item));
}

function isMobileHomeActive(active: string) {
  return active === "Inicio";
}

function isNavSectionId(value: unknown): value is NavSectionId {
  return typeof value === "string" && navSections.some((section) => section.id === value);
}

function navSectionIcon(sectionId: NavSectionId): LucideIcon {
  switch (sectionId) {
    case "main":
      return House;
    case "shipments":
      return ClipboardList;
    case "agencies":
      return Building2;
    case "stock":
      return Boxes;
    case "warehouse":
      return PackageCheck;
    case "operations":
      return Truck;
    case "finance":
      return Landmark;
    case "reports":
      return BarChart3;
    case "admin":
      return Settings;
  }
}

function sidebarGroupsExpandedStorageKey(session: AppSession | null) {
  return `${SIDEBAR_GROUPS_EXPANDED_KEY_PREFIX}:${session?.userId ?? "anonymous"}`;
}

function navOnboardingTarget(href: string) {
  if (href === "/configuracion") {
    return ONBOARDING_TARGETS.NAV_CONFIGURACION;
  }

  if (href === "/inventario") {
    return ONBOARDING_TARGETS.NAV_INVENTARIO;
  }

  if (href === "/venta") {
    return ONBOARDING_TARGETS.NAV_VENTA;
  }

  return undefined;
}

type ShellNavItemProps = {
  item: NavItemDef;
  label: string;
  session?: AppSession | null;
  isActive: boolean;
  variant: "sidebar" | "mobile" | "rail";
  onNavigate?: (isActive: boolean, hasSubmenu?: boolean) => void;
};

function ShellNavItem({ item, label, isActive, variant, onNavigate }: ShellNavItemProps) {
  const Icon = item.icon;
  const onboardingTarget = navOnboardingTarget(item.href);

  if (variant === "rail") {
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        title={label}
        aria-label={label}
        data-onboarding-target={onboardingTarget}
        onClick={() => onNavigate?.(isActive, item.hasSubmenu)}
        className={`relative flex h-11 w-full items-center justify-center rounded-lg border transition-colors duration-200 ${
          isActive
            ? "border-black bg-[#33413c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            : "border-transparent text-slate-300 hover:border-black hover:bg-surface-card hover:text-white"
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-emerald-200" : "text-slate-400"}`} />
      </Link>
    );
  }

  if (variant === "sidebar") {
    const isWorkflowItem = Boolean(item.flowStep);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        data-onboarding-target={onboardingTarget}
        onClick={() => onNavigate?.(isActive, item.hasSubmenu)}
        className={`relative flex min-w-0 items-center gap-3 rounded-lg border px-3 text-left text-base font-black transition-colors duration-200 ${
          isActive
            ? isWorkflowItem
              ? "min-h-12 border-black bg-[#33413c] py-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              : "h-11 border-black bg-[#33413c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            : isWorkflowItem
              ? "min-h-11 border-transparent py-2 text-slate-300 hover:border-black hover:bg-surface-card hover:text-white"
              : "h-11 border-transparent text-slate-300 hover:border-black hover:bg-surface-card hover:text-white"
        }`}
      >
        {isWorkflowItem ? <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${isActive ? "bg-white/10 text-slate-100" : "bg-slate-700/40 text-slate-400"}`}>{item.flowStep}</span> : null}
        <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-slate-100" : "text-slate-400"}`} />
        <span className={isWorkflowItem ? "min-w-0 flex-1 whitespace-normal leading-tight" : "min-w-0 flex-1 truncate"}>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      key={item.href}
      href={item.href}
      prefetch
      data-onboarding-target={onboardingTarget}
      onClick={() => onNavigate?.(isActive, item.hasSubmenu)}
      className={`flex h-12 min-w-0 items-center gap-3 rounded-lg border px-3 text-sm font-black transition-all duration-200 active:scale-[0.98] ${
        isActive ? "border-black bg-emerald-400 text-slate-950" : "border-black bg-surface-card text-slate-300"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </Link>
  );
}

function MobileBottomNav({
  session,
  items,
  active,
  moreOpen,
  onMore,
}: {
  session: AppSession | null;
  items: NavItemDef[];
  active: string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const primary = mobilePrimaryNavItems(session, items);
  const activeInPrimary = primary.some((item) => navItemLabel(item, session) === active);
  const moreActive = !isMobileHomeActive(active) && !activeInPrimary;

  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-[120] border-t border-black bg-[#17201d]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.32)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
        <Link href="/" className={`mobile-tab ${isMobileHomeActive(active) ? "mobile-tab-active" : ""}`} aria-current={isMobileHomeActive(active) ? "page" : undefined}><House className="h-5 w-5" /><span>Inicio</span></Link>
        {primary.map((item) => {
          const Icon = item.icon;
          const selected = navItemLabel(item, session) === active;
          return <Link key={item.href} href={item.href} className={`mobile-tab ${selected ? "mobile-tab-active" : ""}`} aria-current={selected ? "page" : undefined}><Icon className="h-5 w-5" /><span>{navItemLabel(item, session)}</span></Link>;
        })}
        {primary.length < 2 ? <span className="mobile-tab pointer-events-none opacity-0" aria-hidden /> : null}
        <button type="button" onClick={onMore} className={`mobile-tab ${moreOpen || moreActive ? "mobile-tab-active" : ""}`} aria-expanded={moreOpen} aria-label={moreOpen ? "Cerrar más opciones" : "Abrir más opciones"}><MoreHorizontal className="h-5 w-5" /><span>Más</span></button>
      </div>
    </nav>
  );
}

export function AppShell({
  session,
  active,
  children,
  compactContent,
  compactNavLabel,
  compactNavFocusKey,
  onCompactNavClick,
  hideCompactNavHeader,
  compactNavSettingsHref,
  contextNavLabel,
  onContextNavBack,
  contextNavTarget,
  contextNavKeepBrand = false,
  onActiveClick,
  contentEdgeToEdge = false,
  surfaceContextId = null,
}: AppShellProps & { session: AppSession | null }) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<NavSectionId[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarNavItems = useMemo(() => navItemsForSession(session), [session]);
  const sidebarNavGroups = useMemo(() => navGroupsForItems(sidebarNavItems), [sidebarNavItems]);
  const collapsibleSidebarGroupIds = useMemo(
    () => sidebarNavGroups.filter((section) => section.items.length > 0).map((section) => section.id),
    [sidebarNavGroups],
  );
  const allSidebarGroupsExpanded = useMemo(
    () =>
      collapsibleSidebarGroupIds.length > 0 &&
      collapsibleSidebarGroupIds.every((sectionId) => expandedSidebarGroups.includes(sectionId)),
    [collapsibleSidebarGroupIds, expandedSidebarGroups],
  );
  const activeItem =
    sidebarNavItems.find((item) => navItemLabel(item, session) === active) ??
    sidebarNavItems[0] ??
    navItems[0];
  const mobileNavItems = useMemo(() => sidebarNavItems, [sidebarNavItems]);
  const mobileMoreNavGroups = useMemo(() => {
    const primaryHrefs = new Set(mobilePrimaryNavItems(session, mobileNavItems).map((item) => item.href));
    return navGroupsForItems(mobileNavItems.filter((item) => !primaryHrefs.has(item.href)));
  }, [mobileNavItems, session]);
  const showCompactSidebar = hasCompactSidebarContent(compactContent);
  const showContextNav = Boolean(contextNavLabel && onContextNavBack);
  const showMobileMainNav = mobileNavItems.length > 0;
  const showDesktopRail = desktopSidebarCollapsed && !(navCollapsed && showCompactSidebar);
  const sidebarGroupsStorageKey = sidebarGroupsExpandedStorageKey(session);

  useEffect(() => {
    const stored = localStorage.getItem(DESKTOP_SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      queueMicrotask(() => setDesktopSidebarCollapsed(true));
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(sidebarGroupsStorageKey);
    if (!stored) {
      return;
    }

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return;
      }

      const savedGroups = parsed.filter(isNavSectionId);
      queueMicrotask(() => setExpandedSidebarGroups(savedGroups));
    } catch {
      // An older or malformed browser value should never block navigation.
    }
  }, [sidebarGroupsStorageKey]);

  function toggleDesktopSidebar() {
    setDesktopSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem(DESKTOP_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  function toggleSidebarGroup(sectionId: NavSectionId) {
    setExpandedSidebarGroups((current) => {
      const next = current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId];

      localStorage.setItem(sidebarGroupsStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function toggleAllSidebarGroups() {
    const next = allSidebarGroupsExpanded ? [] : collapsibleSidebarGroupIds;
    setExpandedSidebarGroups(next);
    localStorage.setItem(sidebarGroupsStorageKey, JSON.stringify(next));
  }

  function collapseToCompactNav() {
    setNavCollapsed(true);
    window.sessionStorage.setItem("boxario-nav-collapsed", "1");
  }

  useEffect(() => {
    if (!showCompactSidebar) {
      queueMicrotask(() => {
        setNavCollapsed((current) => {
          if (!current) {
            return current;
          }

          window.sessionStorage.removeItem("boxario-nav-collapsed");
          return false;
        });
      });
      return;
    }

    queueMicrotask(() => {
      setNavCollapsed((current) => {
        if (current) {
          return current;
        }

        window.sessionStorage.setItem("boxario-nav-collapsed", "1");
        return true;
      });
    });
  }, [active, showCompactSidebar, compactNavFocusKey]);

  function expandNav() {
    setNavCollapsed(false);
    window.sessionStorage.removeItem("boxario-nav-collapsed");
  }

  function handleCompactNavClick() {
    if (onCompactNavClick) {
      onCompactNavClick();
      return;
    }

    expandNav();
  }

  const organizationBrandTitle = resolveOrganizationBrandingFromSession({
    organizationName: session?.organizationName ?? "",
    organizationShortName: session?.organizationShortName,
    organizationLogoUrl: session?.organizationLogoUrl,
  }).brandTitle;
  const compactNavTitle = compactNavLabel ?? activeItem.label;
  const compactNavBackTitle = onCompactNavClick ? "Volver" : "Mostrar menu";
  const brandTitle = shellBrandTitle(active, contextNavLabel, organizationBrandTitle);

  function handleNavClick(isActive: boolean, hasSubmenu?: boolean) {
    setMobileMenuOpen(false);

    if (isActive && hasSubmenu && showCompactSidebar) {
      collapseToCompactNav();
    }

    if (isActive) {
      onActiveClick?.();
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-surface-shell text-[#f8fafc] lg:h-dvh lg:overflow-hidden">
      <div
        className={`flex min-h-dvh w-full bg-surface-shell lg:h-full lg:min-h-0 ${
          contentEdgeToEdge
            ? "gap-3 py-3 pl-3 pr-0 sm:gap-4 sm:py-4 sm:pl-4"
            : "gap-4 p-3 sm:gap-5 sm:p-5"
        }`}
      >
        <aside
          className={`hidden shrink-0 overflow-visible rounded-xl border border-black bg-surface-panel shadow-md transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:sticky lg:top-5 lg:z-[100] lg:flex lg:max-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-2.5rem)] lg:flex-col ${
            showDesktopRail ? "w-16 p-2" : "w-64 p-3"
          }`}
        >
          {navCollapsed && showCompactSidebar ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {hideCompactNavHeader ? null : (
                <CompactNavHeader
                  compactNavTitle={compactNavTitle}
                  compactNavBackTitle={compactNavBackTitle}
                  onCompactNavClick={handleCompactNavClick}
                  compactNavSettingsHref={compactNavSettingsHref}
                />
              )}
              {compactContent}
            </div>
          ) : (
            <>
              <div className="mb-4">
                {showDesktopRail ? (
                  <div className="flex justify-center">
                    <NotificationsCenter session={session} variant="brand" />
                  </div>
                ) : (
                  <BoxarioBrandHeader
                    session={session}
                    compact
                    className="w-full min-w-0"
                    onBack={showContextNav ? onContextNavBack : undefined}
                    title={showContextNav ? brandTitle : undefined}
                    backTarget={showContextNav ? contextNavTarget : undefined}
                    keepBrand={contextNavKeepBrand}
                    sidebarGroupsToggle={{
                      allExpanded: allSidebarGroupsExpanded,
                      onToggle: toggleAllSidebarGroups,
                    }}
                  />
                )}
              </div>

              <nav className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {sidebarNavGroups.map((section) => {
                  const canCollapse = section.items.length > 0;
                  const sectionCollapsed =
                    !showDesktopRail && canCollapse && !expandedSidebarGroups.includes(section.id);
                  const sectionExpanded = !sectionCollapsed;
                  const isWarehouseSection = section.id === "warehouse";
                  const groupPanelId = `sidebar-group-${section.id}`;
                  const SectionIcon = navSectionIcon(section.id);
                  const collapsedGroupHeaderClass =
                    "border-black/75 bg-surface-inset/55 hover:border-emerald-900/80 hover:bg-[#27342f]";

                  return (
                    <div key={section.id} className="space-y-1.5">
                      {!showDesktopRail ? (
                        <button
                          type="button"
                          onClick={canCollapse ? () => toggleSidebarGroup(section.id) : undefined}
                          aria-controls={canCollapse ? groupPanelId : undefined}
                          aria-expanded={canCollapse ? sectionExpanded : undefined}
                          className={`group flex min-h-11 w-full items-center justify-between rounded-lg border px-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.99] ${
                            canCollapse
                              ? `cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
                                  sectionExpanded ? "sidebar-group-expanded" : collapsedGroupHeaderClass
                                }`
                              : "cursor-default"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                                sectionExpanded
                                  ? "sidebar-group-expanded-icon"
                                  : "border-black/70 bg-surface-card text-emerald-200 group-hover:bg-[#34443d] group-hover:text-emerald-100"
                              }`}
                            >
                              <SectionIcon className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                            </span>
                            {isWarehouseSection ? (
                              <span
                                className={`flex min-w-0 flex-col text-[9px] font-black uppercase leading-[0.86rem] tracking-[0.08em] ${
                                  sectionExpanded ? "text-emerald-100" : "text-slate-200"
                                }`}
                              >
                                <span>Flujo</span>
                                <span>de bodega</span>
                              </span>
                            ) : (
                              <span
                                className={`truncate text-[11px] font-black uppercase leading-none tracking-[0.08em] ${
                                  sectionExpanded ? "text-emerald-100" : "text-slate-200"
                                }`}
                              >
                                {section.label}
                              </span>
                            )}
                          </span>
                          {canCollapse ? (
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${
                                sectionExpanded
                                  ? "sidebar-group-expanded-chevron"
                                  : "border-black/70 bg-black/20 text-emerald-200 group-hover:bg-black/30"
                              }`}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  sectionCollapsed ? "-rotate-90" : "rotate-0"
                                }`}
                                aria-hidden
                              />
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                      <div
                        id={!showDesktopRail && canCollapse ? groupPanelId : undefined}
                        aria-hidden={sectionCollapsed}
                        inert={sectionCollapsed}
                        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
                          sectionCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                        }`}
                      >
                        <div className="min-h-0">
                          <div className="grid gap-1">
                            {section.items.map((item) => {
                              const label = navItemLabel(item, session);

                              return (
                                <ShellNavItem
                                  key={item.href}
                                  item={item}
                                  label={label}
                                  isActive={label === active}
                                  variant={showDesktopRail ? "rail" : "sidebar"}
                                  onNavigate={handleNavClick}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </nav>
            </>
          )}

          <div className="mt-auto hidden pt-4 lg:block">
            <OnboardingCoachSidebarCountdown
              variant={showDesktopRail ? "rail" : "sidebar"}
            />
            <SidebarFooterControls
              contextId={surfaceContextId}
              sidebarCollapsed={showDesktopRail}
              onToggleSidebar={toggleDesktopSidebar}
              variant={showDesktopRail ? "rail" : "sidebar"}
            />
            <UserAccountMenu
              session={session}
              variant={showDesktopRail ? "rail" : "sidebar"}
            />
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-visible lg:min-h-0 lg:overflow-hidden">
          <div className="mb-3 flex items-stretch gap-2 lg:hidden">
            <BoxarioBrandHeader
              session={session}
              compact
              className="min-w-0 flex-1"
              onBack={showContextNav ? onContextNavBack : undefined}
              title={showContextNav ? brandTitle : undefined}
              backTarget={showContextNav ? contextNavTarget : undefined}
              keepBrand={contextNavKeepBrand}
            />
            <UserAccountMenu session={session} variant="bar" />
            {surfaceContextId ? (
              <SidebarPageSurfaceControls contextId={surfaceContextId} variant="bar" />
            ) : null}
          </div>


          {navCollapsed && showCompactSidebar ? (
            <div className="sticky top-3 z-50 mb-4 grid gap-3 lg:hidden">
              {hideCompactNavHeader ? null : (
                <CompactNavHeader
                  compact
                  compactNavTitle={compactNavTitle}
                  compactNavBackTitle={compactNavBackTitle}
                  onCompactNavClick={handleCompactNavClick}
                  compactNavSettingsHref={compactNavSettingsHref}
                />
              )}
              {compactContent}
            </div>
          ) : null}

          <div className="flex flex-col overflow-x-hidden pb-24 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
            {children}
          </div>

          {showMobileMainNav ? (
            <>
              <MobileBottomNav
                session={session}
                items={mobileNavItems}
                active={active}
                moreOpen={mobileMenuOpen}
                onMore={() => setMobileMenuOpen((open) => !open)}
              />

              {mobileMenuOpen ? (
                <div className="fixed inset-0 z-[110] lg:hidden">
                  <button
                    type="button"
                    aria-label="Cerrar más opciones"
                    className="absolute inset-0 bg-black/45"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <nav aria-label="Más opciones" className="absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-h-[72dvh] space-y-3 overflow-y-auto rounded-t-[1.5rem] border border-black bg-surface-panel p-4 shadow-[0_-18px_44px_rgba(0,0,0,0.55)]">
                    <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-slate-600" />
                    {mobileMoreNavGroups.map((section) => {
                      const canCollapse = section.items.length > 0;
                      const sectionCollapsed = canCollapse && !expandedSidebarGroups.includes(section.id);
                      const sectionExpanded = !sectionCollapsed;
                      const groupPanelId = `mobile-more-group-${section.id}`;
                      const SectionIcon = navSectionIcon(section.id);

                      return (
                        <div key={section.id} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={canCollapse ? () => toggleSidebarGroup(section.id) : undefined}
                            aria-controls={canCollapse ? groupPanelId : undefined}
                            aria-expanded={canCollapse ? sectionExpanded : undefined}
                            className="group flex min-h-11 w-full items-center justify-between rounded-lg border border-black/75 bg-surface-inset/55 px-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/70 bg-surface-card text-emerald-200">
                                <SectionIcon className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                              </span>
                              <span className="truncate text-[11px] font-black uppercase leading-none tracking-[0.08em] text-slate-200">
                                {section.label}
                              </span>
                            </span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/70 bg-black/20 text-emerald-200">
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  sectionCollapsed ? "-rotate-90" : "rotate-0"
                                }`}
                                aria-hidden
                              />
                            </span>
                          </button>
                          <div
                            id={canCollapse ? groupPanelId : undefined}
                            aria-hidden={sectionCollapsed}
                            inert={sectionCollapsed}
                            className={sectionCollapsed ? "hidden" : "grid gap-1"}
                          >
                            {section.items.map((item) => {
                              const label = navItemLabel(item, session);

                              return (
                                <ShellNavItem
                                  key={item.href}
                                  item={item}
                                  label={label}
                                  isActive={label === active}
                                  variant="mobile"
                                  onNavigate={handleNavClick}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </nav>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
