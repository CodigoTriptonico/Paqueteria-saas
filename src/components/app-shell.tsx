"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  ClipboardList,
  CreditCard,
  House,
  LucideIcon,
  Settings,
  Shield,
} from "lucide-react";
import { useEffect, useMemo, useState, ViewTransition } from "react";
import { UserAccountMenu } from "@/components/user-account-menu";
import { canAccessPath } from "@/lib/auth/permissions";
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
  children: React.ReactNode;
};

function hasCompactSidebarContent(content: React.ReactNode) {
  return content !== null && content !== undefined && content !== false;
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

function navItemsForSession(session: AppSession | null) {
  if (!session) {
    return navItems;
  }

  return navItems.filter((item) => canAccessPath(session, item.href));
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
  onActiveClick,
}: AppShellProps & { session: AppSession | null }) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const allowedNavItems = useMemo(() => navItemsForSession(session), [session]);
  const activeItem = allowedNavItems.find((item) => item.label === active) ?? allowedNavItems[0];
  const showCompactSidebar = hasCompactSidebarContent(compactContent);

  const mobileNavItems = useMemo(() => allowedNavItems, [allowedNavItems]);

  function collapseToCompactNav() {
    setNavCollapsed(true);
    window.sessionStorage.setItem("paquemas-nav-collapsed", "1");
  }

  useEffect(() => {
    if (!showCompactSidebar) {
      queueMicrotask(() => {
        setNavCollapsed(false);
        window.sessionStorage.removeItem("paquemas-nav-collapsed");
      });
      return;
    }

    queueMicrotask(() => {
      collapseToCompactNav();
    });
  }, [active, showCompactSidebar, compactNavFocusKey]);

  function expandNav() {
    setNavCollapsed(false);
    window.sessionStorage.removeItem("paquemas-nav-collapsed");
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
    <main className="min-h-screen bg-surface-shell text-[#f8fafc]">
      <div className="flex min-h-screen w-full gap-4 bg-surface-shell p-3 sm:gap-5 sm:p-5">
        <aside className="hidden w-72 shrink-0 overflow-visible rounded-xl border border-black bg-surface-panel p-4 shadow-md transition-all duration-300 ease-out lg:sticky lg:top-5 lg:z-[100] lg:flex lg:max-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-2.5rem)] lg:flex-col">
          {!navCollapsed ? (
            <div className="motion-enter-top mb-8 rounded-xl border border-black bg-surface-card p-4 text-[#f8fafc] shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">SaaS</p>
              <h1 className="text-2xl font-black">Paquemas</h1>
            </div>
          ) : null}

          {navCollapsed && showCompactSidebar ? (
            <div className="motion-enter-left flex min-h-0 flex-1 flex-col gap-3">
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
            <nav className="motion-enter-left grid gap-2">
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.label === active;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    transitionTypes={["app-nav"]}
                    onClick={() => handleNavClick(isActive, item.hasSubmenu)}
                    className={`flex h-14 min-w-0 items-center gap-3 rounded-lg border px-4 text-left text-lg font-black transition-all duration-200 hover:translate-x-1 ${
                      isActive
                        ? "border-black bg-surface-card text-white"
                        : "border-transparent text-slate-300 hover:border-black hover:bg-surface-card hover:text-white"
                    }`}
                  >
                    <Icon className="h-6 w-6 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hasSubmenu ? (
                      <ChevronRight
                        className={`h-5 w-5 shrink-0 ${
                          isActive ? "text-slate-400" : "text-slate-500"
                        }`}
                        aria-hidden
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          )}

          {!navCollapsed ? (
            <div className="mt-auto hidden pt-4 lg:block">
              <UserAccountMenu session={session} variant="sidebar" />
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 flex-1">
          <div
            className={`motion-enter-top sticky top-3 z-50 mb-4 flex justify-end lg:top-5 ${
              navCollapsed ? "lg:flex" : "lg:hidden"
            }`}
          >
            <UserAccountMenu session={session} variant="bar" />
          </div>

          {navCollapsed && showCompactSidebar ? (
            <div className="motion-enter-top sticky top-3 z-50 mb-4 grid gap-3 lg:hidden">
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

          {!navCollapsed ? (
            <nav className="motion-enter-top mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:grid-cols-3 lg:hidden">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.label === active;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    transitionTypes={["app-nav"]}
                    onClick={() => handleNavClick(isActive, item.hasSubmenu)}
                    className={`relative flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 text-center text-xs font-black transition-all duration-200 active:scale-[0.98] sm:min-h-16 sm:text-sm ${
                      isActive
                        ? "border-black bg-surface-card text-white"
                        : "border-black bg-surface-card text-slate-300"
                    }`}
                  >
                    {item.hasSubmenu ? (
                      <ChevronRight
                        className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-slate-500"
                        aria-hidden
                      />
                    ) : null}
                    <Icon className="mb-1 h-6 w-6" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <ViewTransition
            key={activeItem.href}
            name="app-content"
            enter={{ "app-nav": "app-fade", default: "none" }}
            exit={{ "app-nav": "app-fade", default: "none" }}
            default="none"
          >
            {children}
          </ViewTransition>
        </section>
      </div>
    </main>
  );
}
