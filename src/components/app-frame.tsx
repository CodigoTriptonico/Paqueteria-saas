"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import { conductorTasksNavLabel } from "@/lib/conductor-tareas-view";
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
  contentEdgeToEdge?: boolean;
};

type ShellConfigPatch = (patch: ShellConfig) => void;

const ShellConfigContext = createContext<ShellConfigPatch | null>(null);

function activeFromPath(pathname: string, session: AppSession | null) {
  if (pathname.startsWith("/venta")) {
    return "Nueva venta";
  }

  if (pathname.startsWith("/inventario")) {
    return "Inventario";
  }

  if (pathname.startsWith("/envios")) {
    return "Envios";
  }

  if (pathname.startsWith("/conductor/inventario-camion")) {
    return "Inventario camion";
  }

  if (pathname.startsWith("/conductor")) {
    return conductorTasksNavLabel(session?.roleSlug ?? "administrador");
  }

  if (pathname.startsWith("/logistica")) {
    return "Logistica";
  }

  if (pathname.startsWith("/estadisticas") || pathname.startsWith("/vendedores")) {
    return "Estadisticas";
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
  const mergeShellConfig = useCallback((patch: ShellConfig) => {
    setConfig((current) => ({ ...current, ...patch }));
  }, []);
  const active = useMemo(() => activeFromPath(pathname, session), [pathname, session]);

  const defaultContextNav = useMemo(() => {
    if (pathname === "/" || pathname.startsWith("/login")) {
      return null;
    }

    const homeHref =
      session && platformAdminNeedsClientContext(session) ? "/platform" : "/";

    return {
      contextNavLabel: activeFromPath(pathname, session),
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
      <ShellConfigContext.Provider value={mergeShellConfig}>
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
        contentEdgeToEdge={config.contentEdgeToEdge}
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
