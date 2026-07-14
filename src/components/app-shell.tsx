"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Box,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  History,
  House,
  ListTodo,
  LucideIcon,
  Menu,
  PackageCheck,
  Settings,
  Shield,
  Truck,
  Layers3,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UserAccountMenu } from "@/components/user-account-menu";
import { SidebarFooterControls, SidebarPageSurfaceControls } from "@/components/ui/sidebar-page-surface-controls";
import { OnboardingCoachSidebarCountdown } from "@/components/onboarding/onboarding-coach-countdown";
import { BoxarioBrandHeader, NotificationsCenter } from "@/components/notifications/notifications-center";
import { canAccessPath, platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import { conductorTasksNavLabel } from "@/lib/conductor-tareas-view";
import { ONBOARDING_TARGETS } from "@/lib/onboarding/coach-targets";
import type { UiSurfaceContextId } from "@/lib/ui-surface-context";
import type { AppSession } from "@/lib/auth/types";

type NavSectionId = "main" | "shipments" | "stock" | "warehouse" | "operations" | "reports" | "admin";

const navSections: { id: NavSectionId; label: string }[] = [
  { id: "main", label: "Trabajo" },
  { id: "shipments", label: "Envíos" },
  { id: "stock", label: "Stock" },
  { id: "warehouse", label: "Flujo de bodega" },
  { id: "operations", label: "Operación" },
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
  { label: "Seguimiento", href: "/seguimiento", icon: ClipboardList, section: "shipments" },
  { label: "Historial envíos", href: "/seguimiento/historial", icon: History, section: "shipments" },
  { label: "Inventario", href: "/inventario", icon: Boxes, section: "stock", hasSubmenu: true },
  { label: "Ingreso a bodega", href: "/ingreso-bodega", icon: Box, section: "warehouse", flowStep: "01" },
  { label: "Bodega", href: "/bodega", icon: PackageCheck, section: "warehouse", flowStep: "02" },
  { label: "Paletas", href: "/paletas", icon: Layers3, section: "warehouse", flowStep: "03" },
  { label: "Logistica", href: "/logistica", icon: Truck, section: "operations" },
  { label: "Tareas conductor", href: "/conductor/tareas", icon: ListTodo, section: "operations" },
  { label: "Inventario camion", href: "/conductor/inventario-camion", icon: Boxes, section: "operations" },
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
  contentEdgeToEdge?: boolean;
  surfaceContextId?: UiSurfaceContextId | null;
  children: React.ReactNode;
};

function hasCompactSidebarContent(content: React.ReactNode) {
  return content !== null && content !== undefined && content !== false;
}

function shellBrandTitle(active: string, contextNavLabel?: string) {
  if (!contextNavLabel) {
    return "Boxario";
  }

  return contextNavLabel === active ? "Boxario" : contextNavLabel;
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

  const needsClient = platformAdminNeedsClientContext(session);

  return navItems.filter((item) => {
    if (item.platformOnly) {
      return session.isPlatformAdmin;
    }
    if (needsClient) {
      return true;
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

function isNavSectionId(value: unknown): value is NavSectionId {
  return typeof value === "string" && navSections.some((section) => section.id === value);
}

function navSectionIcon(sectionId: NavSectionId): LucideIcon {
  switch (sectionId) {
    case "main":
      return House;
    case "shipments":
      return ClipboardList;
    case "stock":
      return Boxes;
    case "warehouse":
      return PackageCheck;
    case "operations":
      return Truck;
    case "reports":
      return BarChart3;
    case "admin":
      return Settings;
  }
}

function sidebarGroupsExpandedStorageKey(session: AppSession | null) {
  return `${SIDEBAR_GROUPS_EXPANDED_KEY_PREFIX}:${session?.userId ?? "anonymous"}`;
}

function isNavItemLocked(session: AppSession | null, item: NavItemDef) {
  if (!session || item.platformOnly) {
    return false;
  }
  return platformAdminNeedsClientContext(session);
}

const LOCKED_NAV_HINT = "Selecciona una paquetería en Plataforma y pulsa Operar";

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
  session: AppSession | null;
  isActive: boolean;
  variant: "sidebar" | "mobile" | "rail";
  onNavigate?: (isActive: boolean, hasSubmenu?: boolean) => void;
};

function ShellNavItem({ item, label, session, isActive, variant, onNavigate }: ShellNavItemProps) {
  const Icon = item.icon;
  const locked = isNavItemLocked(session, item);
  const onboardingTarget = navOnboardingTarget(item.href);

  if (locked) {
    const lockedClass =
      variant === "sidebar"
        ? "flex h-11 min-w-0 cursor-not-allowed items-center gap-3 rounded-lg border border-transparent px-3 text-left text-base font-black text-slate-600 opacity-50"
        : variant === "rail"
          ? "flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg border border-transparent text-slate-600 opacity-50"
          : "flex h-12 min-w-0 cursor-not-allowed items-center gap-3 rounded-lg border border-black bg-surface-card px-3 text-sm font-black text-slate-600 opacity-50";

    return (
      <span key={item.href} className={lockedClass} title={LOCKED_NAV_HINT} aria-disabled="true">
        <Icon className="h-5 w-5 shrink-0" />
        {variant === "sidebar" ? (
          <span className="min-w-0 flex-1 truncate">{label}</span>
        ) : variant === "mobile" ? (
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        ) : null}
      </span>
    );
  }

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
  onActiveClick,
  contentEdgeToEdge = false,
  surfaceContextId = null,
}: AppShellProps & { session: AppSession | null }) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<NavSectionId[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const needsClientSelection = platformAdminNeedsClientContext(session);
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
  const mobileNavGroups = useMemo(() => navGroupsForItems(mobileNavItems), [mobileNavItems]);
  const showCompactSidebar = hasCompactSidebarContent(compactContent);
  const showContextNav = Boolean(contextNavLabel && onContextNavBack);
  const showMobileMainNav = !(navCollapsed && showCompactSidebar) && mobileNavItems.length > 0;
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

  const compactNavTitle = compactNavLabel ?? activeItem.label;
  const compactNavBackTitle = onCompactNavClick ? "Volver" : "Mostrar menu";
  const brandTitle = shellBrandTitle(active, contextNavLabel);

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
                    sidebarGroupsToggle={{
                      allExpanded: allSidebarGroupsExpanded,
                      onToggle: toggleAllSidebarGroups,
                    }}
                  />
                )}
              </div>

              <nav className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {!showDesktopRail && needsClientSelection ? (
                  <p className="mb-1 rounded-lg border border-amber-800/50 bg-amber-950/25 px-3 py-2 text-xs font-bold leading-snug text-amber-100">
                    Elige una paquetería en <span className="text-amber-300">Plataforma</span> y pulsa{" "}
                    <span className="text-amber-300">Operar</span>
                    .
                  </p>
                ) : null}
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
                                  session={session}
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
            />
            <UserAccountMenu session={session} variant="bar" />
            {surfaceContextId ? (
              <SidebarPageSurfaceControls contextId={surfaceContextId} variant="bar" />
            ) : null}
          </div>

          {needsClientSelection ? (
            <div className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/25 px-4 py-2 text-sm font-bold text-amber-100 lg:hidden">
              Operación bloqueada hasta elegir una paquetería en Plataforma.
            </div>
          ) : null}

          {session?.isActingAsClient ? (
            <div className="mb-4 rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-4 py-2 text-sm font-bold text-emerald-100">
              Operando en{" "}
              <span className="text-emerald-300">{session.actingOrganizationName}</span>
              <span className="font-normal text-emerald-200/80">
                {" "}
                · datos de inventario, ventas y configuración de este cliente
              </span>
            </div>
          ) : null}

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

          <div className="flex flex-col overflow-x-hidden pb-20 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
            {children}
          </div>

          {showMobileMainNav ? (
            <>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="fixed bottom-5 right-5 z-[120] flex h-14 w-14 items-center justify-center rounded-full border border-black bg-emerald-400 text-slate-950 shadow-[0_10px_28px_rgba(0,0,0,0.45)] active:scale-[0.96] lg:hidden"
                aria-label={mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>

              {mobileMenuOpen ? (
                <div className="fixed inset-0 z-[110] lg:hidden">
                  <button
                    type="button"
                    aria-label="Cerrar menu"
                    className="absolute inset-0 bg-black/45"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <nav className="absolute inset-x-3 bottom-24 max-h-[62dvh] space-y-3 overflow-y-auto rounded-xl border border-black bg-surface-panel p-3 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
                    {mobileNavGroups.map((section) => (
                      <div key={section.id} className="space-y-1.5">
                        <p className="px-2 text-[10px] font-black uppercase leading-none text-slate-500">
                          {section.label}
                        </p>
                        <div className="grid gap-1">
                          {section.items.map((item) => {
                            const label = navItemLabel(item, session);

                            return (
                              <ShellNavItem
                                key={item.href}
                                item={item}
                                label={label}
                                session={session}
                                isActive={label === active}
                                variant="mobile"
                                onNavigate={handleNavClick}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
