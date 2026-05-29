"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import type { AppSession } from "@/lib/auth/types";

type ShellConfig = {
  compactContent?: React.ReactNode;
  compactNavLabel?: string;
  compactNavFocusKey?: string | number;
  onCompactNavClick?: () => void;
  hideCompactNavHeader?: boolean;
  compactNavSettingsHref?: string;
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
  const [config, setConfig] = useState<ShellConfig>({});
  const active = useMemo(() => activeFromPath(pathname), [pathname]);

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
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
      >
        {children}
      </AppShell>
    </ShellConfigContext.Provider>
  );
}

export function useSetShellConfig() {
  const setConfig = useContext(ShellConfigContext);

  if (!setConfig) {
    throw new Error("useSetShellConfig must be used inside AppFrame");
  }

  return setConfig;
}
