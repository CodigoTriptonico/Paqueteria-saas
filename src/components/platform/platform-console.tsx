"use client";

import {
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Ellipsis,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  Warehouse,
  XCircle,
} from "lucide-react";
import {
  deactivateOrganizationAction,
  deleteOrganizationAction,
  listAllOrganizationsAction,
  reactivateOrganizationAction,
  updateOrganizationAction,
} from "@/app/actions/platform";
import { PlatformCreateClientWizard } from "@/components/platform/platform-create-client-wizard";
import { useContextNav } from "@/hooks/use-context-nav";
import { useNotify } from "@/hooks/use-notify";
import { DEFAULT_MAX_WAREHOUSES } from "@/lib/organizations/settings";
import {
  inputClass,
  labelMutedClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import type { PlatformOrganizationRow } from "@/lib/auth/types";
import {
  formatPlatformExtraUserLimit,
  formatPlatformUserCount,
  formatPlatformWarehouseCount,
  formatPlatformWarehouseLimit,
  summarizePlatformOrganizations,
} from "@/lib/platform-console-summary";

type StatusFilter = "all" | "active" | "inactive";

const FILTER_OPTIONS: { value: StatusFilter; label: string; emoji: string }[] = [
  { value: "all", label: "Todas", emoji: "✨" },
  { value: "active", label: "Activas", emoji: "🟢" },
  { value: "inactive", label: "Inactivas", emoji: "💤" },
];

const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-black bg-[#3A1818] px-3 text-sm font-black text-rose-100 transition hover:bg-[#4A2020] disabled:cursor-not-allowed disabled:opacity-40";

type OrganizationContextMenu = {
  organizationId: string;
  x: number;
  y: number;
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${active ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-rose-700 bg-rose-950/40 text-rose-200"}`}
    >
      {active ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <span className={`${labelMutedClass} block`}>{children}</span>;
}

export function PlatformConsole() {
  const notify = useNotify();
  const [organizations, setOrganizations] = useState<PlatformOrganizationRow[]>(
    [],
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editMaxUsers, setEditMaxUsers] = useState(5);
  const [editMaxWarehouses, setEditMaxWarehouses] = useState(DEFAULT_MAX_WAREHOUSES);
  const [editAgenciesEnabled, setEditAgenciesEnabled] = useState(false);
  const [contextMenu, setContextMenu] =
    useState<OrganizationContextMenu | null>(null);

  const selectedOrg =
    organizations.find((org) => org.id === selectedOrgId) || null;
  const contextOrganization = contextMenu
    ? organizations.find((org) => org.id === contextMenu.organizationId) || null
    : null;
  const platformStats = useMemo(
    () => summarizePlatformOrganizations(organizations),
    [organizations],
  );

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listAllOrganizationsAction();
    if (!result.ok) {
      setError(result.error);
      setOrganizations([]);
    } else {
      setOrganizations(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrganizations();
    });
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedOrg) return;
    queueMicrotask(() => {
      setEditOrgName(selectedOrg.name);
      setEditOrgSlug(selectedOrg.slug);
      setEditMaxUsers(selectedOrg.max_users ?? 5);
      setEditMaxWarehouses(selectedOrg.max_warehouses ?? DEFAULT_MAX_WAREHOUSES);
      setEditAgenciesEnabled(selectedOrg.agencies_enabled);
    });
  }, [selectedOrg]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = (event: Event) => {
      if (event instanceof PointerEvent && event.button === 2) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-platform-company-context-menu]")
      ) {
        return;
      }
      setContextMenu(null);
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    const closeMenuOnScroll = () => setContextMenu(null);

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    window.addEventListener("scroll", closeMenuOnScroll, true);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
      window.removeEventListener("scroll", closeMenuOnScroll, true);
    };
  }, [contextMenu]);

  const filteredOrganizations = useMemo(() => {
    const search = query.trim().toLowerCase();
    return organizations.filter((org) => {
      const matchesSearch =
        !search ||
        org.name.toLowerCase().includes(search) ||
        org.slug.toLowerCase().includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && org.is_active) ||
        (statusFilter === "inactive" && !org.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [organizations, query, statusFilter]);

  const selectOrganization = useCallback((organizationId: string) => {
    setSelectedOrgId(organizationId);
    setShowEditOrg(false);
    setShowArchiveConfirm(false);
  }, []);

  const openContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, organizationId: string) => {
      event.preventDefault();
      selectOrganization(organizationId);
      setContextMenu({
        organizationId,
        x: Math.min(event.clientX, window.innerWidth - 224),
        y: Math.min(event.clientY, window.innerHeight - 196),
      });
    },
    [selectOrganization],
  );

  const platformNavTitle = showCreateOrg
    ? "Nueva paqueteria"
    : selectedOrg?.name || "Plataforma";
  const handlePlatformNavBack = useCallback(() => {
    if (showCreateOrg) {
      setShowCreateOrg(false);
      return;
    }
    setSelectedOrgId(null);
    setShowEditOrg(false);
    setShowArchiveConfirm(false);
    setContextMenu(null);
  }, [showCreateOrg]);
  useContextNav({ title: platformNavTitle, onBack: handlePlatformNavBack });

  function openEditOrganization(organization: PlatformOrganizationRow) {
    selectOrganization(organization.id);
    setEditOrgName(organization.name);
    setEditOrgSlug(organization.slug);
    setEditMaxUsers(organization.max_users ?? 5);
    setEditMaxWarehouses(organization.max_warehouses ?? DEFAULT_MAX_WAREHOUSES);
    setEditAgenciesEnabled(organization.agencies_enabled);
    setShowArchiveConfirm(false);
    setShowEditOrg(true);
    setContextMenu(null);
  }

  async function handleUpdateOrg(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrg) return;
    setSaving(true);
    const result = await updateOrganizationAction({
      organizationId: selectedOrg.id,
      name: editOrgName,
      slug: editOrgSlug,
      maxUsers: editMaxUsers,
      maxWarehouses: editMaxWarehouses,
      agenciesEnabled: editAgenciesEnabled,
    });
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success("Empresa actualizada.");
    setShowEditOrg(false);
    await loadOrganizations();
  }

  async function handleToggleActive(organization = selectedOrg) {
    if (!organization) return;
    setSaving(true);
    const result = organization.is_active
      ? await deactivateOrganizationAction(organization.id)
      : await reactivateOrganizationAction(organization.id);
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success(
      organization.is_active ? "Empresa desactivada." : "Empresa reactivada.",
    );
    setContextMenu(null);
    await loadOrganizations();
  }

  async function handleArchive() {
    if (!selectedOrg) return;
    setSaving(true);
    const result = await deleteOrganizationAction(selectedOrg.id);
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success("Empresa cerrada y archivada; su historial se conservó.");
    setShowArchiveConfirm(false);
    setSelectedOrgId(null);
    await loadOrganizations();
  }

  if (loading) {
    return (
      <Panel title="Empresas">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando empresas...
        </p>
      </Panel>
    );
  }

  if (showCreateOrg) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] w-full flex-1 flex-col">
        <PlatformCreateClientWizard
          onCancel={() => setShowCreateOrg(false)}
          onError={(message) => notify.error(message)}
          onCreated={async (organizationId, summary) => {
            notify.success(summary);
            setShowCreateOrg(false);
            setSelectedOrgId(organizationId);
            await loadOrganizations();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Panel
        className={selectedOrg ? "hidden" : "min-h-[calc(100dvh-7rem)] border-0 bg-transparent"}
        contentClassName="p-0"
        hideHeader
        title="Empresas"
      >
        <header className="rounded-xl border border-black bg-surface-card px-5 py-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)] sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Administración de plataforma</p>
              <h1 className="mt-1 flex items-center gap-2 text-3xl font-black tracking-tight text-slate-100 sm:text-4xl">
                <Building2 className="h-7 w-7 text-emerald-300 sm:h-8 sm:w-8" aria-hidden />
                Empresas
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-bold text-slate-400">
                Cada empresa controla por su cuenta sus usuarios, permisos y datos operativos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateOrg(true)}
              className={`${primaryButtonClass} h-11 shrink-0 px-4 shadow-[0_8px_18px_rgba(16,185,129,0.12)]`}
            >
              <Plus className="h-4 w-4" />
              Nueva empresa
            </button>
          </div>
        </header>
        <div className="p-4 sm:p-5">
        {error ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filtrar empresas por estado">
          {FILTER_OPTIONS.map((filter) => {
            const summary =
              filter.value === "all"
                ? { label: "Todas", value: platformStats.total, tone: "text-slate-100" }
                : filter.value === "active"
                  ? { label: "Activas", value: platformStats.active, tone: "text-emerald-300" }
                  : { label: "Inactivas", value: platformStats.inactive, tone: "text-rose-300" };
            const selected = statusFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={selected}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-black shadow-sm transition ${selected ? "bg-emerald-400 text-slate-950 shadow-emerald-500/20" : filter.value === "active" ? "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25" : filter.value === "inactive" ? "bg-rose-400/15 text-rose-200 hover:bg-rose-400/25" : "bg-sky-400/15 text-sky-100 hover:bg-sky-400/25"}`}
              >
                <span aria-hidden>{filter.emoji}</span>
                <span>{summary.label}</span>
                <span className={`tabular-nums ${selected ? "text-slate-950" : summary.tone}`}>
                  {summary.value}
                </span>
              </button>
            );
          })}
          <span className="ml-auto flex items-center gap-3 px-1 text-xs font-bold text-slate-400">
            <span>
              👥{" "}
              <b className="text-slate-100">{platformStats.users}</b>{" "}
              {platformStats.users === 1 ? "usuario" : "usuarios"}
            </span>
            <span>
              🏭{" "}
              <b className="text-slate-100">{platformStats.warehouses}</b>{" "}
              {platformStats.warehouses === 1 ? "bodega" : "bodegas"}
            </span>
          </span>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            {filteredOrganizations.length} {filteredOrganizations.length === 1 ? "empresa" : "empresas"}
          </p>
          <label className="relative block w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa"
              className={`${inputClass} inset-field h-11 w-full rounded-full border-0 bg-slate-950/70 pl-10 shadow-inner`}
            />
          </label>
        </div>
        {filteredOrganizations.length ? (
          <div className="grid gap-3">
            {filteredOrganizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => selectOrganization(org.id)}
                onContextMenu={(event) => openContextMenu(event, org.id)}
                className="group grid w-full cursor-context-menu gap-4 rounded-xl border border-black bg-surface-card p-4 text-left shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-colors hover:bg-surface-card-hover sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                aria-label={`Abrir empresa ${org.name}. Clic derecho para más opciones.`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black bg-surface-inset text-emerald-300" aria-hidden>
                      <Building2 className="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-black text-slate-100">
                        {org.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-bold text-slate-400">
                        {org.slug}
                      </span>
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-black text-slate-300 sm:justify-end">
                  <StatusPill active={org.is_active} />
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    {formatPlatformUserCount(org.user_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Warehouse className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    <span>{formatPlatformWarehouseCount(org.warehouse_count)}</span>
                    <Ellipsis className="h-4 w-4 text-slate-500" aria-hidden />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-surface-inset/40 p-8 text-center">
            <Building2 className="mx-auto h-7 w-7 text-slate-500" />
            <p className="mt-3 font-black text-slate-200">
              No hay empresas con ese filtro.
            </p>
          </div>
        )}
        </div>
      </Panel>

      {selectedOrg ? (
        <Panel
          title={selectedOrg.name}
          className="min-h-[calc(100dvh-7rem)]"
          contentClassName="p-0"
          hideHeader
        >
          <header className="rounded-xl border border-black bg-surface-card px-5 py-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePlatformNavBack}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-slate-100 transition-colors hover:bg-surface-card-hover"
              >
                <ArrowLeft className="h-4 w-4" />
                Empresas
              </button>
              <div className="flex items-center gap-2">
                <StatusPill active={selectedOrg.is_active} />
                <button
                  type="button"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      organizationId: selectedOrg.id,
                      x: Math.max(8, rect.right - 216),
                      y: rect.bottom + 8,
                    });
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 transition-colors hover:bg-surface-card-hover"
                  aria-label={`Abrir opciones de ${selectedOrg.name}`}
                  title="Opciones"
                >
                  <Ellipsis className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black bg-surface-inset text-emerald-300" aria-hidden>
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Administración de empresa</p>
                <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-slate-100 sm:text-4xl">
                  {selectedOrg.name}
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  Usuarios, bodegas y operación de esta empresa.
                </p>
              </div>
            </div>
          </header>
          <div className="p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-black bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <p className={labelMutedClass}>Usuarios</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-slate-100">
                {selectedOrg.user_count}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Con acceso a esta empresa
              </p>
            </div>
            <div className="rounded-xl border border-black bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <p className={labelMutedClass}>Módulo Agencias</p>
              <p className={`mt-1 text-sm font-black ${selectedOrg.agencies_enabled ? "text-emerald-300" : "text-slate-400"}`}>
                {selectedOrg.agencies_enabled ? "Habilitado" : "No incluido"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Controlado por Boxario
              </p>
            </div>
            <div className="rounded-xl border border-black bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <p className={labelMutedClass}>Bodegas</p>
              <p className="mt-1 flex items-center gap-1 text-3xl font-black tabular-nums text-slate-100">
                <Warehouse className="h-4 w-4 text-emerald-300" />
                {selectedOrg.warehouse_count}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Registradas en la operación
              </p>
            </div>
            <div className="rounded-xl border border-black bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <p className={labelMutedClass}>Limites</p>
              <p className="mt-1 text-sm font-black text-slate-100">
                {formatPlatformExtraUserLimit(selectedOrg.max_users)}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {formatPlatformWarehouseLimit(selectedOrg.max_warehouses)}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-3">
                <span className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="py-4">
                  <p className={labelMutedClass}>Identidad de la empresa</p>
                  <p className="text-base font-black text-slate-100">
                    {selectedOrg.name}
                  </p>
                </div>
              </div>
              <dl className="grid gap-3 border-t border-black bg-surface-inset/40 p-4 sm:grid-cols-2">
                <div>
                  <dt className={labelMutedClass}>Identificador</dt>
                  <dd className="mt-1 font-mono text-sm font-black text-slate-200">
                    {selectedOrg.slug}
                  </dd>
                </div>
                <div>
                  <dt className={labelMutedClass}>Tipo</dt>
                  <dd className="mt-1 text-sm font-black text-slate-200">
                    Paquetería
                  </dd>
                </div>
              </dl>
            </section>
            <section className="rounded-xl border border-black bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <p className={labelMutedClass}>Cuenta y operación</p>
              <p className="mt-2 text-sm font-black text-slate-100">
                Datos separados por empresa
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                Usuarios, permisos y registros operativos quedan dentro de esta paquetería.
              </p>
            </section>
          </div>
          </div>
          {showEditOrg ? (
            <form
              onSubmit={handleUpdateOrg}
              className="mt-5 grid gap-4 rounded-xl border border-black bg-surface-card p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <FieldLabel>Nombre comercial</FieldLabel>
                  <input
                    required
                    value={editOrgName}
                    onChange={(event) => setEditOrgName(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Slug</FieldLabel>
                  <input
                    required
                    value={editOrgSlug}
                    onChange={(event) => setEditOrgSlug(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Usuarios extra permitidos</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={editMaxUsers}
                    onChange={(event) =>
                      setEditMaxUsers(Number(event.target.value))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Bodegas permitidas</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editMaxWarehouses}
                    onChange={(event) =>
                      setEditMaxWarehouses(Number(event.target.value))
                    }
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editAgenciesEnabled}
                  onClick={() => setEditAgenciesEnabled((enabled) => !enabled)}
                  className={`flex min-h-20 items-center justify-between gap-4 rounded-xl border px-4 text-left sm:col-span-2 ${
                    editAgenciesEnabled
                      ? "border-emerald-600 bg-emerald-950/35"
                      : "border-black bg-surface-inset"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black text-slate-100">Módulo Agencias</span>
                    <span className="mt-1 block text-xs font-bold text-slate-400">
                      Permite crear agencias y usar sus flujos operativos. Los datos se conservan si se desactiva.
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-7 w-12 shrink-0 rounded-full border border-black p-1 transition ${
                      editAgenciesEnabled ? "justify-end bg-emerald-400" : "justify-start bg-surface-card"
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-slate-950" />
                  </span>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  className={`${primaryButtonClass} h-10 text-sm`}
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditOrg(false)}
                  className={`${secondaryButtonClass} h-10 text-sm`}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}
          {showArchiveConfirm ? (
            <div className="mt-5 rounded-xl border border-rose-800 bg-rose-950/30 p-4">
              <p className="font-black text-rose-100">Archivar esta empresa?</p>
              <p className="mt-1 text-sm text-rose-200/80">
                Se bloquea el acceso y se conserva el historial. Esta accion no
                borra sus datos.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleArchive()}
                  className={dangerButtonClass}
                >
                  {saving ? "Archivando..." : "Si, archivar empresa"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className={`${secondaryButtonClass} h-10 text-sm`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
      {contextMenu && contextOrganization ? (
        <div
          role="menu"
          data-platform-company-context-menu
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-black px-3 py-2">
            <p className="truncate text-sm font-black text-[#f8fafc]">
              {contextOrganization.name}
            </p>
            <p className="truncate text-xs font-bold text-slate-500">
              {contextOrganization.slug}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-hover"
            onClick={() => {
              selectOrganization(contextOrganization.id);
              setContextMenu(null);
            }}
          >
            <Building2 className="h-4 w-4 text-emerald-300" />
            Ver datos
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-hover"
            onClick={() => openEditOrganization(contextOrganization)}
          >
            <Pencil className="h-4 w-4" />
            Editar empresa
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={saving}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-[#f8fafc] hover:bg-surface-card-hover disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void handleToggleActive(contextOrganization)}
          >
            {contextOrganization.is_active ? (
              <XCircle className="h-4 w-4 text-amber-300" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            )}
            {contextOrganization.is_active ? "Desactivar" : "Reactivar"}
          </button>
          <div className="border-t border-black" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-rose-200 hover:bg-[#3A1818]"
            onClick={() => {
              selectOrganization(contextOrganization.id);
              setShowEditOrg(false);
              setShowArchiveConfirm(true);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Cerrar y archivar
          </button>
        </div>
      ) : null}
    </>
  );
}
