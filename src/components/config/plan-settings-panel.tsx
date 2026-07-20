"use client";

import { Building2, Gauge, Mail, Network, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getOrganizationPlanLimitsAction,
  type OrganizationPlanUsage,
} from "@/app/actions/organization";
import { PageLoading } from "@/components/page-loading";
import {
  settingsIconBoxClass as iconBoxClass,
  settingsSectionClass as sectionClass,
} from "@/components/config/settings-panel-styles";

const sectionHeaderClass = "border-b border-black bg-surface-card-header px-4 py-3";

function usageTone(used: number, max: number | null) {
  if (max === null) {
    return "text-slate-300";
  }

  if (used >= max) {
    return "text-amber-300";
  }

  if (max > 1 && used >= max - 1) {
    return "text-amber-200/90";
  }

  return "text-[#f8fafc]";
}

function PlanLimitCard({
  icon: Icon,
  title,
  used,
  max,
  unitSingular,
  unitPlural,
  detail,
}: {
  icon: typeof Building2;
  title: string;
  used: number;
  max: number | null;
  unitSingular: string;
  unitPlural: string;
  detail: string;
}) {
  const overLimit = max !== null && used > max;
  const atLimit = max !== null && used === max;
  const remaining = max !== null ? Math.max(0, max - used) : null;
  const unit = used === 1 ? unitSingular : unitPlural;

  return (
    <article
      className={`${sectionClass} ${overLimit ? "border-amber-500/40" : ""}`}
    >
      <div className={`${sectionHeaderClass} flex items-center gap-3`}>
        <span className={iconBoxClass}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-base font-black text-[#f8fafc]">{title}</p>
          <p className="text-xs font-bold text-slate-400">{detail}</p>
        </div>
      </div>

      <div className="px-4 py-4">
        {max === null ? (
          <>
            <p className="text-3xl font-black tabular-nums text-[#f8fafc]">{used}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {used} {unit} · sin límite configurado en el plan
            </p>
          </>
        ) : overLimit ? (
          <>
            <p className="text-3xl font-black tabular-nums text-[#f8fafc]">{used}</p>
            <p className="mt-1 text-sm font-bold text-slate-300">
              {used} {unit} en tu cuenta
            </p>
            <p className="mt-3 text-sm font-black text-amber-300">
              Límite del plan: {max} {max === 1 ? unitSingular : unitPlural}
            </p>
            <p className="mt-2 text-xs font-bold leading-snug text-amber-100/80">
              El contrato registrado está desactualizado: tienes más {unitPlural} de las
              que figuran en el plan. Pide al administrador que actualice el límite a
              mínimo {used}.
            </p>
          </>
        ) : (
          <>
            <p className={`text-3xl font-black tabular-nums ${usageTone(used, max)}`}>
              {used}
              <span className="text-lg font-bold text-slate-500"> / {max}</span>
            </p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {used} {unit} · límite del plan {max}
            </p>
            <p className="mt-2 text-xs font-bold text-slate-500">
              {atLimit
                ? `Has llegado al límite. No puedes crear más ${unitPlural}.`
                : remaining === 1
                  ? `Queda 1 ${unitSingular} disponible.`
                  : `Quedan ${remaining} ${unitPlural} disponibles.`}
            </p>
          </>
        )}
      </div>
    </article>
  );
}

export function PlanSettingsPanel() {
  const [usage, setUsage] = useState<OrganizationPlanUsage | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getOrganizationPlanLimitsAction();
      setLoaded(true);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUsage(result.data);
    });
  }, []);

  if (!loaded) {
    return <PageLoading />;
  }

  if (error || !usage) {
    return (
      <p className="rounded-xl border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-200">
        {error || "No se pudo cargar el plan."}
      </p>
    );
  }

  const totalUsersAllowed = usage.maxUsers !== null ? usage.maxUsers + 1 : null;

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-black bg-[#1a2320] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className={iconBoxClass}>
            <Gauge className="h-4 w-4" />
          </span>
          <div>
            <p className="text-lg font-black text-[#f8fafc]">Límites del plan</p>
            <p className="mt-1 text-sm font-bold text-slate-400">
              Uso actual de tu paquetería según el contrato configurado por el
              administrador de la plataforma.
            </p>
          </div>
        </div>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${usage.agenciesEnabled ? "xl:grid-cols-3" : ""}`}>
        <PlanLimitCard
          icon={Building2}
          title="Bodegas"
          used={usage.warehouseCount}
          max={usage.maxWarehouses}
          unitSingular="bodega"
          unitPlural="bodegas"
          detail="Activas e inactivas cuentan para el límite."
        />

        <PlanLimitCard
          icon={Users}
          title="Usuarios adicionales"
          used={usage.extraUserCount}
          max={usage.maxUsers}
          unitSingular="usuario adicional"
          unitPlural="usuarios adicionales"
          detail={
            totalUsersAllowed !== null
              ? `${usage.userCount} en total · hasta ${totalUsersAllowed} con el dueño.`
              : "El dueño no cuenta en el límite de adicionales."
          }
        />

        {usage.agenciesEnabled ? <section className={sectionClass}>
          <div className={`${sectionHeaderClass} flex items-center gap-3`}>
            <span className={iconBoxClass}>
              <Network className="h-4 w-4" />
            </span>
            <div>
              <p className="text-base font-black text-[#f8fafc]">Módulo Agencias</p>
              <p className="text-xs font-bold text-slate-400">Capacidad exclusiva del contrato.</p>
            </div>
          </div>
          <div className="px-4 py-4">
            <p className="text-xl font-black text-emerald-300">Incluido</p>
            <p className="mt-2 text-xs font-bold leading-snug text-slate-500">
              La creación y operación de agencias está habilitada para esta empresa.
            </p>
          </div>
        </section> : null}
      </div>

      <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-4">
        <p className="text-sm font-black text-amber-100">¿Necesitas ampliar el plan?</p>
        <p className="mt-1 text-sm font-bold leading-snug text-amber-100/80">
          Para agregar más bodegas o usuarios, contacte con el administrador de la
          plataforma. Solo ellos pueden modificar los límites del contrato.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-400">
          <Mail className="h-3.5 w-3.5" />
          Los cambios se aplican desde la consola de plataforma Boxario.
        </p>
      </section>
    </div>
  );
}
