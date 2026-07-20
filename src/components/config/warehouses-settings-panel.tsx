"use client";

import {
  ArrowRightLeft,
  Building2,
  ChevronDown,
  Plus,
  RefreshCw,
  Settings2,
  Star,
  Warehouse,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WarehouseBinsPanel } from "@/components/config/warehouse-bins-panel";
import { PlanUsageLink, PLAN_CONFIG_HREF } from "@/components/config/plan-usage-link";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  copyWarehouseCatalogAction,
  createWarehouseAction,
  deactivateWarehouseAction,
  listWarehousesAction,
  reactivateWarehouseAction,
  setDefaultWarehouseAction,
} from "@/app/actions/warehouses";
import { updateOrganizationSettingsAction, getOrganizationPlanLimitsAction } from "@/app/actions/organization";
import { getCurrentSessionAction } from "@/app/actions/session";
import { inputClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { sessionHasPermission } from "@/lib/auth/permissions";
import {
  settingsIconBoxClass as iconBoxClass,
  settingsSectionClass as sectionClass,
  settingsSectionHeaderClass as sectionHeaderClass,
  settingsSectionTitleClass as sectionTitleClass,
} from "@/components/config/settings-panel-styles";

const compactInputClass = `${inputClass} h-10`;
const rowClass =
  "flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-surface-card-hover";

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border border-black p-0.5 transition disabled:opacity-50 ${
        checked ? "bg-emerald-400" : "bg-surface-inset"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-slate-950 transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

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

export function WarehousesSettingsPanel() {
  const router = useRouter();
  const notify = useNotify();
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; code: string | null; is_active: boolean; is_default: boolean }[]
  >([]);
  const [multiWarehouse, setMultiWarehouse] = useState(false);
  const [planMaxWarehouses, setPlanMaxWarehouses] = useState<number | null>(null);
  const [canManageWarehouses, setCanManageWarehouses] = useState(false);
  const [canManageSettings, setCanManageSettings] = useState(false);
  const [newName, setNewName] = useState("");
  const [copyFromId, setCopyFromId] = useState("");
  const [copyToId, setCopyToId] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [pickingPrincipal, setPickingPrincipal] = useState(false);
  const [principalSavingId, setPrincipalSavingId] = useState("");

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
  const defaultWarehouse = useMemo(
    () =>
      activeWarehouses.find((warehouse) => warehouse.is_default) ||
      activeWarehouses[0] ||
      null,
    [activeWarehouses],
  );
  const totalWarehouses = warehouses.length;
  const overPlanLimit =
    planMaxWarehouses !== null && totalWarehouses > planMaxWarehouses;
  const hubCanBeEnabled =
    planMaxWarehouses !== null && planMaxWarehouses >= 2;
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
      const rows = warehousesResult.data;
      setWarehouses(rows);

      const active = rows.filter((warehouse) => warehouse.is_active);
      const nextFrom = active[0]?.id || "";
      const nextTo = active.find((warehouse) => warehouse.id !== nextFrom)?.id || "";

      setCopyFromId(nextFrom);
      setCopyToId(nextTo);
    }

    if (sessionResult.ok && sessionResult.data) {
      const session = sessionResult.data;
      setMultiWarehouse(session.multiWarehouseEnabled);
      setCanManageWarehouses(sessionHasPermission(session, "warehouses.manage"));
      setCanManageSettings(sessionHasPermission(session, "settings.manage"));
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

  useEffect(() => {
    if (pickingPrincipal) {
      queueMicrotask(() => {
        setShowOptions(true);
      });
    }
  }, [pickingPrincipal]);

  const optionsSummary = useMemo(() => {
    const parts: string[] = [];

    if (defaultWarehouse) {
      parts.push(`Principal: ${defaultWarehouse.name}`);
    }

    if (canManageSettings) {
      parts.push(multiWarehouse ? "Hub activo" : "Entrada directa");
    }

    return parts.join(" · ");
  }, [canManageSettings, defaultWarehouse, multiWarehouse]);

  const showOptionsPanel =
    canManageSettings ||
    Boolean(defaultWarehouse) ||
    (canManageWarehouses && activeWarehouses.length >= 2);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();

    if (!name) {
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
    notify.success(
      warehouses.length
        ? "Bodega creada con catálogo en 0."
        : "Bodega creada.",
    );
    await reload();
  }

  async function choosePrincipalWarehouse(warehouseId: string) {
    if (!canManageWarehouses || warehouseId === defaultWarehouse?.id) {
      setPickingPrincipal(false);
      return;
    }

    setPrincipalSavingId(warehouseId);

    const result = await setDefaultWarehouseAction(warehouseId);

    setPrincipalSavingId("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setWarehouses((current) =>
      current.map((warehouse) => ({
        ...warehouse,
        is_default: warehouse.id === warehouseId,
      })),
    );
    setPickingPrincipal(false);
    notify.success(`${result.data.name} es ahora la bodega principal`);
    router.refresh();
  }

  return (
    <div className="grid gap-4">

      {overPlanLimit ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-sm font-bold leading-snug text-amber-100">
          Tienes {totalWarehouses} bodegas pero el plan registra un límite de{" "}
          {planMaxWarehouses}. El contrato está desactualizado — pide al administrador
          de la plataforma que lo ajuste.{" "}
          <PlanUsageLink className="text-amber-200" />
        </p>
      ) : null}

      {!canManageWarehouses ? (
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

            {canManageWarehouses && !pickingPrincipal ? (
              <form
                className="flex w-full min-w-0 max-w-md flex-1 items-center gap-2 sm:w-auto"
                onSubmit={handleCreate}
              >
                <input
                  className={`${compactInputClass} min-w-0 flex-1`}
                  placeholder="Nueva bodega"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy || !newName.trim() || atWarehouseLimit}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 disabled:opacity-50"
                  title={
                    atWarehouseLimit
                      ? `Límite del plan alcanzado (${planMaxWarehouses} en total)`
                      : "Crear bodega"
                  }
                  aria-label="Crear bodega"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            ) : null}
          </div>

          {pickingPrincipal ? (
            <p className="border-b border-black/80 bg-amber-950/20 px-4 py-2.5 text-sm font-bold text-amber-100">
              Toca una bodega de la lista para marcarla como principal.
            </p>
          ) : null}

          {!activeWarehouses.length && !inactiveWarehouses.length ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base font-black text-[#f8fafc]">Sin bodegas</p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                Crea la primera arriba.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/80">
              {activeWarehouses.map((warehouse) => {
                const isPrincipal = warehouse.is_default;
                const isSaving = principalSavingId === warehouse.id;
                const selectable = pickingPrincipal && canManageWarehouses;

                return (
                  <div
                    key={warehouse.id}
                    className={`${rowClass} ${
                      selectable
                        ? isPrincipal
                          ? "bg-amber-400/10"
                          : "cursor-pointer hover:bg-amber-400/5"
                        : ""
                    }`}
                    role={selectable ? "button" : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    onClick={
                      selectable && !isPrincipal && !isSaving
                        ? () => void choosePrincipalWarehouse(warehouse.id)
                        : undefined
                    }
                    onKeyDown={
                      selectable && !isPrincipal
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void choosePrincipalWarehouse(warehouse.id);
                            }
                          }
                        : undefined
                    }
                  >
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
                      {selectable && !isPrincipal ? (
                        <p className="mt-0.5 text-xs font-bold text-amber-200/90">
                          {isSaving ? "Guardando..." : "Tocar para marcar como principal"}
                        </p>
                      ) : null}
                    </div>
                    {canManageWarehouses && !warehouse.is_default && !pickingPrincipal ? (
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-lg border border-rose-800/80 bg-rose-950/20 px-3 text-xs font-black text-rose-200 hover:bg-rose-950/40"
                        onClick={async (event) => {
                          event.stopPropagation();
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
          {showOptionsPanel ? (
            <section className={sectionClass}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => setShowOptions((current) => !current)}
                aria-expanded={showOptions}
              >
                <span className={iconBoxClass}>
                  <Settings2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#f8fafc]">
                    Opciones
                  </span>
                  {!showOptions && optionsSummary ? (
                    <span className="mt-0.5 block truncate text-xs font-bold text-slate-500">
                      {optionsSummary}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition ${
                    showOptions ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>

              {showOptions ? (
                <div className="space-y-4 border-t border-black px-4 py-3">
                  {canManageSettings ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#f8fafc]">
                          Selector en Inventario
                        </p>
                        <p className="mt-0.5 text-xs font-bold leading-snug text-slate-400">
                          {multiWarehouse
                            ? activeWarehouses.length > 1
                              ? "Inventario abre el hub de bodegas."
                              : "Activo, pero necesitas 2+ bodegas."
                            : defaultWarehouse
                              ? `Inventario entra directo a ${defaultWarehouse.name}.`
                              : "Inventario entra directo a la principal."}
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={multiWarehouse}
                        disabled={busy || (!multiWarehouse && !hubCanBeEnabled)}
                        onChange={async (enabled) => {
                          if (enabled && !hubCanBeEnabled) {
                            notify.error(
                              planMaxWarehouses === null
                                ? "Límite de bodegas no configurado. Revisa el plan o contacta al administrador."
                                : "Tu plan permite 1 bodega. Pide ampliar el límite en la plataforma.",
                            );
                            return;
                          }

                          setBusy(true);
                          const result = await updateOrganizationSettingsAction({
                            multiWarehouseEnabled: enabled,
                          });
                          setBusy(false);

                          if (!result.ok) {
                            notify.error(result.error);
                            return;
                          }

                          setMultiWarehouse(enabled);
                          notify.success(
                            enabled
                              ? "Selector de bodegas activado."
                              : "Inventario usará la bodega principal.",
                          );
                          router.refresh();
                        }}
                      />
                    </div>
                  ) : null}

                  {canManageSettings && !hubCanBeEnabled && !multiWarehouse ? (
                    <p className="text-xs font-bold leading-snug text-slate-500">
                      El selector de inventario requiere un plan con al menos 2 bodegas.{" "}
                      <Link
                        href={PLAN_CONFIG_HREF}
                        className="text-emerald-300 underline-offset-2 hover:underline"
                      >
                        Ver plan
                      </Link>
                    </p>
                  ) : null}

                  {defaultWarehouse ? (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-[#1a2320] px-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-500/50 bg-surface-inset">
                        <PrincipalStar filled className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Bodega principal
                        </p>
                        <p className="truncate text-sm font-black text-[#f8fafc]">
                          {defaultWarehouse.name}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {canManageWarehouses && activeWarehouses.length > 1 ? (
                    pickingPrincipal ? (
                      <button
                        type="button"
                        onClick={() => setPickingPrincipal(false)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-black bg-surface-inset text-sm font-black text-slate-300"
                      >
                        <X className="h-4 w-4" />
                        Cancelar selección
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPickingPrincipal(true)}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-400/15 text-sm font-black text-amber-100 hover:bg-amber-400/25"
                      >
                        <PrincipalStar filled={Boolean(defaultWarehouse)} />
                        Elegir bodega principal
                      </button>
                    )
                  ) : null}

                  {canManageWarehouses && activeWarehouses.length >= 2 ? (
                    <div className="space-y-3 border-t border-black/80 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950">
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-black text-[#f8fafc]">
                            Sincronizar catálogo
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                            Opcional
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-bold leading-snug text-slate-400">
                        Copia filas de stock faltantes (cantidad 0). Las bodegas
                        nuevas ya lo hacen al crearse.
                      </p>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-black uppercase text-slate-500">
                          Origen
                        </span>
                        <InlineSearchPicker
                          compact={false}
                          className="w-full"
                          minWidthClass="w-full min-w-0"
                          value={copyFromId}
                          onChange={setCopyFromId}
                          options={activeWarehouses.map((warehouse) => ({
                            value: warehouse.id,
                            label: warehouse.name,
                          }))}
                          placeholder="Elegir origen"
                          searchPlaceholder="Buscar bodega…"
                          ariaLabel="Bodega origen"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-black uppercase text-slate-500">
                          Destino
                        </span>
                        <InlineSearchPicker
                          compact={false}
                          className="w-full"
                          minWidthClass="w-full min-w-0"
                          value={copyToId}
                          onChange={setCopyToId}
                          options={activeWarehouses.map((warehouse) => ({
                            value: warehouse.id,
                            label: warehouse.name,
                          }))}
                          placeholder="Elegir destino"
                          searchPlaceholder="Buscar bodega…"
                          ariaLabel="Bodega destino"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          busy || !copyFromId || !copyToId || copyFromId === copyToId
                        }
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-black text-slate-950 disabled:opacity-50"
                        onClick={async () => {
                          setBusy(true);
                          const result = await copyWarehouseCatalogAction(
                            copyFromId,
                            copyToId,
                          );
                          setBusy(false);

                          if (!result.ok) {
                            notify.error(result.error);
                            return;
                          }

                          notify.success(
                            result.data.copied
                              ? `${result.data.copied} items sincronizados`
                              : "Destino ya estaba al día",
                          );
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Sincronizar
                      </button>
                    </div>
                  ) : null}

                  <p className="border-t border-black/80 pt-3 text-xs font-bold leading-relaxed text-slate-500">
                    Categorías e items son compartidos. Cada bodega guarda su
                    propio stock.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <WarehouseBinsPanel
            warehouses={warehouses}
            canManage={canManageWarehouses || canManageSettings}
          />
        </aside>
      </div>
    </div>
  );
}
