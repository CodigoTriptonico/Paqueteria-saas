"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  House,
  ListTodo,
  LucideIcon,
  Menu,
  Settings,
  Shield,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UserAccountMenu } from "@/components/user-account-menu";
import { BoxarioBrandHeader } from "@/components/notifications/notifications-center";
import { canAccessPath, platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import { conductorTasksNavLabel } from "@/lib/conductor-tareas-view";
import type { AppSession } from "@/lib/auth/types";

const navItems: {
  label: string;
  href: string;
  icon: LucideIcon;
  hasSubmenu?: boolean;
  platformOnly?: boolean;
}[] = [
  { label: "Inicio", href: "/", icon: House },
  { label: "Nueva venta", href: "/venta", icon: CreditCard, hasSubmenu: true },
  { label: "Inventario", href: "/inventario", icon: Boxes, hasSubmenu: true },
  { label: "Envios", href: "/envios", icon: ClipboardList },
  { label: "Tareas conductor", href: "/conductor/tareas", icon: ListTodo },
  { label: "Inventario camion", href: "/conductor/inventario-camion", icon: Boxes },
  { label: "Logistica", href: "/logistica", icon: Truck },
  { label: "Estadisticas", href: "/estadisticas", icon: BarChart3 },
  { label: "Plataforma", href: "/platform", icon: Shield, platformOnly: true },
];

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

function isNavItemLocked(session: AppSession | null, item: NavItemDef) {
  if (!session || item.platformOnly) {
    return false;
  }
  return platformAdminNeedsClientContext(session);
}

const LOCKED_NAV_HINT = "Selecciona una paquetería en Plataforma y pulsa Operar";

type ShellNavItemProps = {
  item: NavItemDef;
  label: string;
  session: AppSession | null;
  isActive: boolean;
  variant: "sidebar" | "mobile";
  onNavigate?: (isActive: boolean, hasSubmenu?: boolean) => void;
};

function ShellNavItem({ item, label, session, isActive, variant, onNavigate }: ShellNavItemProps) {
  const Icon = item.icon;
  const locked = isNavItemLocked(session, item);

  if (locked) {
    const lockedClass =
      variant === "sidebar"
        ? "flex h-14 min-w-0 cursor-not-allowed items-center gap-3 rounded-lg border border-transparent px-4 text-left text-lg font-black text-slate-600 opacity-50"
        : "flex h-12 min-w-0 cursor-not-allowed items-center gap-3 rounded-lg border border-black bg-surface-card px-3 text-sm font-black text-slate-600 opacity-50";

    return (
      <span key={item.href} className={lockedClass} title={LOCKED_NAV_HINT} aria-disabled="true">
        <Icon className={variant === "sidebar" ? "h-6 w-6 shrink-0" : "h-5 w-5 shrink-0"} />
        {variant === "sidebar" ? (
          <span className="min-w-0 flex-1 truncate">{label}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        )}
      </span>
    );
  }

  if (variant === "sidebar") {
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        onClick={() => onNavigate?.(isActive, item.hasSubmenu)}
        className={`flex h-14 min-w-0 items-center gap-3 rounded-lg border px-4 text-left text-lg font-black transition-all duration-200 hover:translate-x-1 ${
          isActive
            ? "border-black bg-surface-card text-white"
            : "border-transparent text-slate-300 hover:border-black hover:bg-surface-card hover:text-white"
        }`}
      >
        <Icon className="h-6 w-6 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      key={item.href}
      href={item.href}
      prefetch
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
}: AppShellProps & { session: AppSession | null }) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const needsClientSelection = platformAdminNeedsClientContext(session);
  const sidebarNavItems = useMemo(() => navItemsForSession(session), [session]);
  const activeItem =
    sidebarNavItems.find((item) => navItemLabel(item, session) === active) ??
    sidebarNavItems[0] ??
    navItems[0];
  const mobileNavItems = useMemo(() => sidebarNavItems, [sidebarNavItems]);
  const showCompactSidebar = hasCompactSidebarContent(compactContent);
  const showContextNav = Boolean(contextNavLabel && onContextNavBack);
  const showMobileMainNav = !(navCollapsed && showCompactSidebar) && mobileNavItems.length > 0;

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
        <aside className="hidden w-72 shrink-0 overflow-visible rounded-xl border border-black bg-surface-panel p-4 shadow-md lg:sticky lg:top-5 lg:z-[100] lg:flex lg:max-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-2.5rem)] lg:flex-col">
          {!navCollapsed ? (
            <BoxarioBrandHeader
              session={session}
              compact
              className="mb-4"
              onBack={showContextNav ? onContextNavBack : undefined}
              title={showContextNav ? brandTitle : undefined}
            />
          ) : null}

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
            <nav className="grid gap-2">
              {needsClientSelection ? (
                <p className="mb-1 rounded-lg border border-amber-800/50 bg-amber-950/25 px-3 py-2 text-xs font-bold leading-snug text-amber-100">
                  Elige una paquetería en <span className="text-amber-300">Plataforma</span> y pulsa{" "}
                  <span className="text-amber-300">Operar</span>.
                </p>
              ) : null}
              {sidebarNavItems.map((item) => (
                <ShellNavItem
                  key={item.href}
                  item={item}
                  label={navItemLabel(item, session)}
                  session={session}
                  isActive={navItemLabel(item, session) === active}
                  variant="sidebar"
                  onNavigate={handleNavClick}
                />
              ))}
            </nav>
          )}

          <div className="mt-auto hidden pt-4 lg:block">
            <UserAccountMenu session={session} variant="sidebar" />
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
                  <nav className="absolute inset-x-3 bottom-24 grid max-h-[62dvh] gap-2 overflow-y-auto rounded-xl border border-black bg-surface-panel p-3 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
                    {mobileNavItems.map((item) => (
                      <ShellNavItem
                        key={item.href}
                        item={item}
                        label={navItemLabel(item, session)}
                        session={session}
                        isActive={navItemLabel(item, session) === active}
                        variant="mobile"
                        onNavigate={handleNavClick}
                      />
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
