"use client";

import { Building2, Plus, Star, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WarehouseBinsPanel } from "@/components/config/warehouse-bins-panel";
import { PlanUsageLink } from "@/components/config/plan-usage-link";
import {
  createWarehouseAction,
  deactivateWarehouseAction,
  listWarehousesAction,
  reactivateWarehouseAction,
} from "@/app/actions/warehouses";
import { getOrganizationPlanLimitsAction } from "@/app/actions/organization";
import { getCurrentSessionAction } from "@/app/actions/session";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { CreateWarehouseModal } from "@/components/config/create-warehouse-modal";
import {
  settingsIconBoxClass as iconBoxClass,
  settingsSectionClass as sectionClass,
  settingsSectionHeaderClass as sectionHeaderClass,
  settingsSectionTitleClass as sectionTitleClass,
} from "@/components/config/settings-panel-styles";

const rowClass =
  "flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-surface-card-hover";

function WarehouseBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "amber" | "emerald" | "muted" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-600/60 bg-amber-400/15 text-amber-200"
      : tone === "emerald"
        ? "border-emerald-600/60 bg-emerald-400/15 text-emerald-200"
        : tone === "rose"
          ? "border-rose-700/60 bg-rose-950/30 text-rose-200"
          : "border-black bg-surface-inset text-slate-400";

  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-black uppercase tracking-wide ${toneClass}`}
    >
      {children}
    </span>
  );
}

function PrincipalStar({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <Star
      className={`${className} ${
        filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-500"
      }`}
      aria-hidden
    />
  );
}

type WarehousesSettingsPanelProps = {
  /** Evita el flash de “sin permiso” cuando el padre ya conoce la sesión. */
  initialCanManageWarehouses?: boolean;
  initialCanManageSettings?: boolean;
};

export function WarehousesSettingsPanel({
  initialCanManageWarehouses,
  initialCanManageSettings,
}: WarehousesSettingsPanelProps = {}) {
  const notify = useNotify();
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; code: string | null; is_active: boolean; is_default: boolean }[]
  >([]);
  const [planMaxWarehouses, setPlanMaxWarehouses] = useState<number | null>(null);
  const [canManageWarehouses, setCanManageWarehouses] = useState(
    Boolean(initialCanManageWarehouses),
  );
  const [canManageSettings, setCanManageSettings] = useState(
    Boolean(initialCanManageSettings),
  );
  const [permissionsReady, setPermissionsReady] = useState(
    typeof initialCanManageWarehouses === "boolean",
  );
  const [newName, setNewName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeWarehouses = useMemo(() => {
    const active = warehouses.filter((warehouse) => warehouse.is_active);
    return [...active].sort((a, b) => {
      if (a.is_default === b.is_default) {
        return 0;
      }

      return a.is_default ? -1 : 1;
    });
  }, [warehouses]);
  const inactiveWarehouses = useMemo(
    () => warehouses.filter((warehouse) => !warehouse.is_active),
    [warehouses],
  );
  const totalWarehouses = warehouses.length;
  const overPlanLimit =
    planMaxWarehouses !== null && totalWarehouses > planMaxWarehouses;
  const atWarehouseLimit =
    planMaxWarehouses === null
      ? totalWarehouses > 0
      : totalWarehouses >= planMaxWarehouses;

  async function reload() {
    const [warehousesResult, sessionResult, limitsResult] = await Promise.all([
      listWarehousesAction(),
      getCurrentSessionAction(),
      getOrganizationPlanLimitsAction(),
    ]);

    if (warehousesResult.ok) {
      setWarehouses(warehousesResult.data);
    }

    if (sessionResult.ok) {
      if (sessionResult.data) {
        const session = sessionResult.data;
        setCanManageWarehouses(sessionHasPermission(session, "warehouses.manage"));
        setCanManageSettings(sessionHasPermission(session, "settings.manage"));
      }
      setPermissionsReady(true);
    }

    if (limitsResult.ok) {
      setPlanMaxWarehouses(limitsResult.data.maxWarehouses);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, []);

  async function handleCreate() {
    const name = newName.trim();

    if (!name || atWarehouseLimit) {
      return;
    }

    setBusy(true);

    const result = await createWarehouseAction({ name });
    setBusy(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setNewName("");
    setShowCreateModal(false);
    notify.success(
      warehouses.length
        ? "Bodega creada con catálogo en 0."
        : "Bodega creada.",
    );
    await reload();
  }

  return (
    <>
    <div className="grid gap-4">

      {overPlanLimit ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-sm font-bold leading-snug text-amber-100">
          Tienes {totalWarehouses} bodegas pero el plan registra un límite de{" "}
          {planMaxWarehouses}. El contrato está desactualizado — pide al administrador
          de la plataforma que lo ajuste.{" "}
          <PlanUsageLink className="text-amber-200" />
        </p>
      ) : null}

      {permissionsReady && !canManageWarehouses ? (
        <p className="rounded-xl border border-black bg-surface-card px-4 py-3 text-sm font-bold text-slate-400">
          No tienes permiso para administrar bodegas.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <section className={sectionClass}>
          <div className={sectionHeaderClass}>
            <div className={sectionTitleClass}>
              <span className={iconBoxClass}>
                <Warehouse className="h-4 w-4" />
              </span>
              <span>
                Bodegas
                <span className="ml-2 inline-flex flex-wrap items-center gap-x-1.5 text-sm font-bold text-slate-400">
                  <span>
                    {totalWarehouses}{" "}
                    {totalWarehouses === 1 ? "bodega" : "bodegas"}
                  </span>
                  <span className="text-slate-600">·</span>
                  <PlanUsageLink />
                </span>
              </span>
            </div>

            {canManageWarehouses ? (
              <button
                type="button"
                disabled={busy}
                className={`${primaryButtonClass} h-10 shrink-0 gap-1.5 px-4`}
                title={
                  atWarehouseLimit
                    ? `Límite del plan alcanzado (${planMaxWarehouses} en total)`
                    : "Crear bodega"
                }
                onClick={() => {
                  setNewName("");
                  setShowCreateModal(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nueva bodega
              </button>
            ) : null}
          </div>

          {!activeWarehouses.length && !inactiveWarehouses.length ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base font-black text-[#f8fafc]">Sin bodegas</p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                Usa Nueva bodega para crear la primera.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/80">
              {activeWarehouses.map((warehouse) => {
                const isPrincipal = warehouse.is_default;

                return (
                  <div key={warehouse.id} className={rowClass}>
                    <span
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                        isPrincipal
                          ? "border-amber-500/60 bg-[#1a2320]"
                          : "border-black bg-surface-inset text-slate-300"
                      }`}
                    >
                      {isPrincipal ? (
                        <PrincipalStar filled className="h-5 w-5" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-black text-[#f8fafc]">
                          {warehouse.name}
                        </p>
                        {warehouse.code && !isPrincipal ? (
                          <WarehouseBadge>{warehouse.code}</WarehouseBadge>
                        ) : null}
                      </div>
                      {isPrincipal ? (
                        <p className="mt-0.5 text-xs font-bold text-amber-300/90">
                          Bodega principal
                        </p>
                      ) : null}
                    </div>
                    {canManageWarehouses && !warehouse.is_default ? (
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-lg border border-rose-800/80 bg-rose-950/20 px-3 text-xs font-black text-rose-200 hover:bg-rose-950/40"
                        onClick={async () => {
                          setBusy(true);
                          const result = await deactivateWarehouseAction(warehouse.id);
                          setBusy(false);

                          if (!result.ok) {
                            notify.error(result.error);
                            return;
                          }

                          notify.success("Bodega desactivada");
                          await reload();
                        }}
                      >
                        Desactivar
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {inactiveWarehouses.length ? (
                <>
                  <div className="bg-surface-card-header/60 px-4 py-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Inactivas ({inactiveWarehouses.length})
                    </p>
                  </div>
                  {inactiveWarehouses.map((warehouse) => (
                    <div key={warehouse.id} className={`${rowClass} opacity-80`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-500">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-slate-400">
                          {warehouse.name}
                        </p>
                      </div>
                      {canManageWarehouses ? (
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={async () => {
                            setBusy(true);
                            const result = await reactivateWarehouseAction(warehouse.id);
                            setBusy(false);

                            if (!result.ok) {
                              notify.error(result.error);
                              return;
                            }

                            notify.success("Bodega reactivada");
                            await reload();
                          }}
                        >
                          Reactivar
                        </button>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </section>

        <aside className="grid gap-4">
          <WarehouseBinsPanel
            warehouses={warehouses}
            canManage={canManageWarehouses || canManageSettings}
          />
        </aside>
      </div>
    </div>

    <CreateWarehouseModal
      open={showCreateModal}
      name={newName}
      busy={busy}
      atLimit={atWarehouseLimit}
      planMaxWarehouses={planMaxWarehouses}
      onClose={() => {
        if (busy) {
          return;
        }
        setShowCreateModal(false);
        setNewName("");
      }}
      onNameChange={setNewName}
      onCreate={() => void handleCreate()}
    />
    </>
  );
}
