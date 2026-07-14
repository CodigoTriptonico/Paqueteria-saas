"use client";

import { ListChecks, Sparkles } from "lucide-react";
import { useState } from "react";
import { setOnboardingStartedAction } from "@/app/actions/onboarding";
import { primaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { optimisticallyStartOnboarding } from "@/hooks/use-onboarding-progress";
import { dispatchOnboardingProgressChanged } from "@/lib/onboarding/refresh";
import { clearOnboardingStartedLocally } from "@/lib/onboarding/started";

type OnboardingStartPanelProps = {
  organizationId: string;
  onStarted?: () => void;
};

export function OnboardingStartPanel({
  organizationId,
  onStarted,
}: OnboardingStartPanelProps) {
  const notify = useNotify();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (starting) {
      return;
    }

    setStarting(true);
    optimisticallyStartOnboarding(organizationId);
    dispatchOnboardingProgressChanged({ silent: true });

    const result = await setOnboardingStartedAction();
    setStarting(false);

    if (!result.ok) {
      clearOnboardingStartedLocally(organizationId);
      notify.error(result.error || "No se pudo iniciar el tutorial.");
    } else {
      onStarted?.();
    }

    dispatchOnboardingProgressChanged({ silent: true });
  }

  return (
    <section className="rounded-xl border border-emerald-600/35 bg-[#243029] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-600/40 bg-emerald-400/15 text-emerald-300">
          <ListChecks className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300/90">
            Configuración inicial
          </p>
          <h3 className="mt-0.5 text-base font-black text-[#f8fafc]">
            Deja tu paquetería lista para vender
          </h3>
          <p className="mt-1.5 text-xs font-bold leading-relaxed text-slate-400">
            Te guiaremos paso a paso: países, inventario, precios, stock y tu primera venta.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={starting}
        className={`${primaryButtonClass} mt-4 h-10 w-full justify-center disabled:opacity-60`}
      >
        <Sparkles className="h-4 w-4" />
        {starting ? "Iniciando…" : "Iniciar tutorial"}
      </button>
    </section>
  );
}
