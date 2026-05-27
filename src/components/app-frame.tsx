"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

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

  return "Inicio";
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<ShellConfig>({});
  const active = useMemo(() => activeFromPath(pathname), [pathname]);

  return (
    <ShellConfigContext.Provider value={setConfig}>
      <AppShell
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
