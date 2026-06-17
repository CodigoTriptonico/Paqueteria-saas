"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  CreditCard,
  House,
  LucideIcon,
  Settings,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UserAccountMenu } from "@/components/user-account-menu";
import { canAccessPath, platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";

const navItems: { label: string; href: string; icon: LucideIcon; hasSubmenu?: boolean; platformOnly?: boolean }[] = [
  { label: "Inicio", href: "/", icon: House },
  { label: "Nueva venta", href: "/venta", icon: CreditCard, hasSubmenu: true },
  { label: "Inventario", href: "/inventario", icon: Boxes, hasSubmenu: true },
  { label: "Envios", href: "/envios", icon: ClipboardList },
  { label: "Configuracion", href: "/configuracion", icon: Settings },
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

type SidebarContextHeaderProps = {
  title: string;
  backTitle?: string;
  onBack: () => void;
  compact?: boolean;
};

function SidebarContextHeader({
  title,
  backTitle = "Volver",
  onBack,
  compact = false,
}: SidebarContextHeaderProps) {
  const iconSize = compact ? "h-7 w-7" : "h-8 w-8";
  const titleSize = compact ? "text-[15px]" : "text-lg";

  return (
    <button
      type="button"
      onClick={onBack}
      title={backTitle}
      aria-label={`${backTitle}: ${title}`}
      className={`group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-black bg-[#1a2320] px-3 py-3 text-left shadow-[0_8px_22px_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/[0.04] transition duration-200 hover:border-emerald-700/35 hover:bg-[#243029] active:scale-[0.99] sm:gap-4 sm:px-4 sm:py-3.5 ${compact ? "min-h-12" : "min-h-[3.75rem]"}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg border border-black bg-[#121816] text-emerald-300/90 transition duration-200 group-hover:border-emerald-700/40 group-hover:bg-emerald-400/10 group-hover:text-emerald-200 ${compact ? "h-10 w-10" : "h-11 w-11 sm:h-12 sm:w-12"}`}
        aria-hidden
      >
        <ArrowLeft
          className={`${iconSize} transition duration-200 group-hover:-translate-x-0.5`}
          strokeWidth={2.5}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-black leading-snug text-[#f8fafc] ${titleSize}`}
        >
          {title}
        </span>
      </span>
    </button>
  );
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
  session: AppSession | null;
  isActive: boolean;
  variant: "sidebar" | "mobile";
  onNavigate?: (isActive: boolean, hasSubmenu?: boolean) => void;
};

function ShellNavItem({ item, session, isActive, variant, onNavigate }: ShellNavItemProps) {
  const Icon = item.icon;
  const locked = isNavItemLocked(session, item);

  if (locked) {
    const lockedClass =
      variant === "sidebar"
        ? "flex h-14 min-w-0 cursor-not-allowed items-center gap-3 rounded-lg border border-transparent px-4 text-left text-lg font-black text-slate-600 opacity-50"
        : "relative flex min-h-14 cursor-not-allowed flex-col items-center justify-center rounded-lg border border-black bg-surface-card px-2 text-center text-xs font-black text-slate-600 opacity-50 sm:min-h-16 sm:text-sm";

    return (
      <span key={item.href} className={lockedClass} title={LOCKED_NAV_HINT} aria-disabled="true">
        <Icon className={variant === "sidebar" ? "h-6 w-6 shrink-0" : "mb-1 h-6 w-6"} />
        {variant === "sidebar" ? (
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        ) : (
          item.label
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
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link
      key={item.href}
      href={item.href}
      prefetch
      onClick={() => onNavigate?.(isActive, item.hasSubmenu)}
      className={`relative flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 text-center text-xs font-black transition-all duration-200 active:scale-[0.98] sm:min-h-16 sm:text-sm ${
        isActive ? "border-black bg-surface-card text-white" : "border-black bg-surface-card text-slate-300"
      }`}
    >
      <Icon className="mb-1 h-6 w-6" />
      {item.label}
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
  const needsClientSelection = platformAdminNeedsClientContext(session);
  const sidebarNavItems = useMemo(() => navItemsForSession(session), [session]);
  const activeItem =
    sidebarNavItems.find((item) => item.label === active) ??
    sidebarNavItems[0] ??
    navItems[0];
  const showCompactSidebar = hasCompactSidebarContent(compactContent);
  const showContextNav = Boolean(contextNavLabel && onContextNavBack);

  const mobileNavItems = useMemo(() => sidebarNavItems, [sidebarNavItems]);

  function collapseToCompactNav() {
    setNavCollapsed(true);
    window.sessionStorage.setItem("boxario-nav-collapsed", "1");
  }

  useEffect(() => {
    if (!showCompactSidebar) {
      queueMicrotask(() => {
        setNavCollapsed(false);
        window.sessionStorage.removeItem("boxario-nav-collapsed");
      });
      return;
    }

    queueMicrotask(() => {
      collapseToCompactNav();
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

  function handleNavClick(isActive: boolean, hasSubmenu?: boolean) {
    if (isActive && hasSubmenu && showCompactSidebar) {
      collapseToCompactNav();
    }

    if (isActive) {
      onActiveClick?.();
    }
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-surface-shell text-[#f8fafc]">
      <div
        className={`flex h-full min-h-0 w-full bg-surface-shell ${
          contentEdgeToEdge
            ? "gap-3 py-3 pl-3 pr-0 sm:gap-4 sm:py-4 sm:pl-4"
            : "gap-4 p-3 sm:gap-5 sm:p-5"
        }`}
      >
        <aside className="hidden w-72 shrink-0 overflow-visible rounded-xl border border-black bg-surface-panel p-4 shadow-md transition-all duration-300 ease-out lg:sticky lg:top-5 lg:z-[100] lg:flex lg:max-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-2.5rem)] lg:flex-col">
          {showContextNav ? (
            <div className="mb-4">
              <SidebarContextHeader
                title={contextNavLabel!}
                onBack={onContextNavBack!}
              />
            </div>
          ) : !navCollapsed ? (
            <div className="mb-8 rounded-xl border border-black bg-surface-card p-4 text-[#f8fafc] shadow-sm">
              <h1 className="text-2xl font-black">Boxario</h1>
            </div>
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
                  session={session}
                  isActive={item.label === active}
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

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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

          <div
            className="sticky top-3 z-50 mb-4 flex justify-end lg:hidden"
          >
            <UserAccountMenu session={session} variant="bar" />
          </div>

          {showContextNav ? (
            <div className="mb-4 lg:hidden">
              <SidebarContextHeader
                compact
                title={contextNavLabel!}
                onBack={onContextNavBack!}
              />
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

          {!navCollapsed || showContextNav ? (
            <nav className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:grid-cols-3 lg:hidden">
              {mobileNavItems.map((item) => (
                <ShellNavItem
                  key={item.href}
                  item={item}
                  session={session}
                  isActive={item.label === active}
                  variant="mobile"
                  onNavigate={handleNavClick}
                />
              ))}
            </nav>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
