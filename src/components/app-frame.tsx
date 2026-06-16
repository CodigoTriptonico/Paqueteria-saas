"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";

type ShellConfig = {
  compactContent?: React.ReactNode;
  compactNavLabel?: string;
  compactNavFocusKey?: string | number;
  onCompactNavClick?: () => void;
  hideCompactNavHeader?: boolean;
  compactNavSettingsHref?: string;
  contextNavLabel?: string;
  onContextNavBack?: () => void;
};

const ShellConfigContext = createContext<((config: ShellConfig) => void) | null>(null);

function activeFromPath(pathname: string) {
  if (pathname.startsWith("/venta")) {
    return "Nueva venta";
  }

  if (pathname.startsWith("/inventario")) {
    return "Inventario";
  }

  if (pathname.startsWith("/envios")) {
    return "Envios";
  }

  if (pathname.startsWith("/configuracion")) {
    return "Configuracion";
  }

  if (pathname.startsWith("/platform")) {
    return "Plataforma";
  }

  return "Inicio";
}

export function AppFrame({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AppSession | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [config, setConfig] = useState<ShellConfig>({});
  const active = useMemo(() => activeFromPath(pathname), [pathname]);

  const defaultContextNav = useMemo(() => {
    if (pathname === "/" || pathname.startsWith("/login")) {
      return null;
    }

    const homeHref =
      session && platformAdminNeedsClientContext(session) ? "/platform" : "/";

    return {
      contextNavLabel: activeFromPath(pathname),
      onContextNavBack: () => router.push(homeHref),
    };
  }, [pathname, router, session]);

  const contextNavLabel = config.contextNavLabel ?? defaultContextNav?.contextNavLabel;
  const onContextNavBack =
    config.onContextNavBack ?? defaultContextNav?.onContextNavBack;

  if (pathname.startsWith("/login")) {
    return (
      <NotificationProvider>
        {children}
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <ShellConfigContext.Provider value={setConfig}>
      <AppShell
        session={session}
        active={active}
        title={active}
        compactContent={config.compactContent}
        compactNavLabel={config.compactNavLabel}
        compactNavFocusKey={config.compactNavFocusKey}
        onCompactNavClick={config.onCompactNavClick}
        hideCompactNavHeader={config.hideCompactNavHeader}
        compactNavSettingsHref={config.compactNavSettingsHref}
        contextNavLabel={contextNavLabel}
        onContextNavBack={onContextNavBack}
      >
        {children}
      </AppShell>
    </ShellConfigContext.Provider>
    </NotificationProvider>
  );
}

export function useSetShellConfig() {
  const setConfig = useContext(ShellConfigContext);

  if (!setConfig) {
    throw new Error("useSetShellConfig must be used inside AppFrame");
  }

  return setConfig;
}
