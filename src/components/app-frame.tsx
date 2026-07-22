"use client";

import { createContext, Suspense, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OnboardingCoachProvider } from "@/components/onboarding/onboarding-coach-context";
import { OnboardingCoachOverlay } from "@/components/onboarding/onboarding-coach-overlay";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { UiSurfacePreferencesProvider } from "@/components/ui/ui-surface-preferences-provider";
import { isPlatformOnlySession } from "@/lib/auth/permissions";
import { conductorTasksNavLabel } from "@/lib/conductor-tareas-view";
import { useHydrated } from "@/hooks/use-hydrated";
import type { UiSurfaceContextId } from "@/lib/ui-surface-context";
import { resolveSurfaceContextFromPathname } from "@/lib/ui-surface-route-context";
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
  contextNavTarget?: string;
  contextNavKeepBrand?: boolean;
  contentEdgeToEdge?: boolean;
  /** Override del contexto de paleta (p. ej. remitente vs destinatario en venta). */
  surfaceContextId?: UiSurfaceContextId | null;
};

type ShellConfigPatch = (patch: ShellConfig) => void;

const ShellConfigContext = createContext<ShellConfigPatch | null>(null);

function activeFromPath(pathname: string, session: AppSession | null) {
  if (pathname.startsWith("/venta")) {
    return "Nueva venta";
  }

  if (pathname.startsWith("/captacion")) {
    return "Agencias a mi cargo";
  }

  if (pathname.startsWith("/agencias")) {
    return "Red de agencias";
  }

  if (pathname.startsWith("/agencia")) {
    return "Mi agencia";
  }

  if (pathname.startsWith("/solicitudes")) {
    return "Solicitudes";
  }

  if (pathname.startsWith("/contabilidad")) {
    return "Contabilidad";
  }

  if (pathname.startsWith("/mis-distribuidores")) {
    return "Mis distribuidores";
  }

  if (pathname.startsWith("/distribuidor")) {
    return pathname.startsWith("/distribuidores") ? "Distribuidores" : "Mi distribuidora";
  }

  if (pathname.startsWith("/inventario")) {
    return "Inventario";
  }

  if (pathname.startsWith("/seguimiento") || pathname.startsWith("/envios")) {
    return "Seguimiento y envíos";
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

  if (pathname.startsWith("/perfil")) {
    return "Mi perfil";
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
  const isHydrated = useHydrated();
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
      session && isPlatformOnlySession(session) ? "/platform" : "/";

    return {
      contextNavLabel: activeFromPath(pathname, session),
      onContextNavBack: () => router.push(homeHref),
    };
  }, [pathname, router, session]);

  const contextNavLabel =
    config.contextNavLabel ?? (isHydrated ? defaultContextNav?.contextNavLabel : undefined);
  const onContextNavBack =
    config.onContextNavBack ?? (isHydrated ? defaultContextNav?.onContextNavBack : undefined);
  const reserveDefaultContextNav =
    !isHydrated && !config.onContextNavBack && Boolean(defaultContextNav?.onContextNavBack);
  const surfaceContextId =
    config.surfaceContextId !== undefined
      ? config.surfaceContextId
      : resolveSurfaceContextFromPathname(pathname);

  if (pathname.startsWith("/login") || pathname.startsWith("/rastrear")) {
    return (
      <NotificationProvider>
        {children}
      </NotificationProvider>
    );
  }

  if (pathname.startsWith("/reloj")) {
    return <NotificationProvider>{children}</NotificationProvider>;
  }

  return (
    <NotificationProvider>
      <UiSurfacePreferencesProvider>
      <ShellConfigContext.Provider value={mergeShellConfig}>
      <Suspense fallback={null}>
        <OnboardingCoachProvider organizationId={session?.organizationId ?? null}>
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
            contextNavTarget={config.contextNavTarget}
            contextNavKeepBrand={config.contextNavKeepBrand}
            reserveContextNav={reserveDefaultContextNav}
            contentEdgeToEdge={config.contentEdgeToEdge}
            surfaceContextId={surfaceContextId}
          >
            {children}
          </AppShell>
          <OnboardingCoachOverlay />
        </OnboardingCoachProvider>
      </Suspense>
    </ShellConfigContext.Provider>
      </UiSurfacePreferencesProvider>
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
