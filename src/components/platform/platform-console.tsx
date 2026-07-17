"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
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
import {
  inputClass,
  labelMutedClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  selectionSurfaceClass,
  textMutedClass,
} from "@/components/ui-blocks";
import type { PlatformOrganizationRow } from "@/lib/auth/types";

type StatusFilter = "all" | "active" | "inactive";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "inactive", label: "Inactivas" },
];

const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-black bg-[#3A1818] px-3 text-sm font-black text-rose-100 transition hover:bg-[#4A2020] disabled:cursor-not-allowed disabled:opacity-40";

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
  const [editMaxWarehouses, setEditMaxWarehouses] = useState(5);

  const selectedOrg =
    organizations.find((org) => org.id === selectedOrgId) || null;

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
      setEditMaxWarehouses(selectedOrg.max_warehouses ?? 5);
    });
  }, [selectedOrg]);

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
  }, [showCreateOrg]);
  useContextNav({ title: platformNavTitle, onBack: handlePlatformNavBack });

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

  async function handleToggleActive() {
    if (!selectedOrg) return;
    setSaving(true);
    const result = selectedOrg.is_active
      ? await deactivateOrganizationAction(selectedOrg.id)
      : await reactivateOrganizationAction(selectedOrg.id);
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success(
      selectedOrg.is_active ? "Empresa desactivada." : "Empresa reactivada.",
    );
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
        title={
          <span className="flex w-full min-w-0 items-center justify-between gap-3">
            <span className="truncate">Empresas</span>
            <button
              type="button"
              onClick={() => setShowCreateOrg(true)}
              className={`${primaryButtonClass} h-10 shrink-0 px-3 text-sm`}
            >
              <Plus className="h-4 w-4" />
              Nueva empresa
            </button>
          </span>
        }
      >
        <p className={`mb-4 max-w-2xl text-sm ${textMutedClass}`}>
          Crea y administra empresas. Cada empresa controla por su cuenta sus
          usuarios, permisos y datos operativos.
        </p>
        {error ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa"
              className={`${inputClass} h-10 w-full pl-9`}
            />
          </label>
          <div className="flex gap-1 overflow-x-auto">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`h-10 shrink-0 rounded-md border px-3 text-xs font-black ${statusFilter === filter.value ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-black bg-surface-inset text-slate-400 hover:bg-surface-card-hover"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {filteredOrganizations.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filteredOrganizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  setSelectedOrgId(org.id);
                  setShowEditOrg(false);
                  setShowArchiveConfirm(false);
                }}
                className={`${selectionSurfaceClass(selectedOrgId === org.id, selectedOrgId !== null && selectedOrgId !== org.id)} min-h-36 p-4 text-left`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-black text-slate-100">
                        {org.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {org.slug}
                      </span>
                    </span>
                  </span>
                  <StatusPill active={org.is_active} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-400">
                  <span>{org.user_count} usuarios</span>
                  <span className="text-right">
                    {org.warehouse_count} bodegas
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
      </Panel>

      {selectedOrg ? (
        <Panel title={selectedOrg.name} className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
            <div>
              <p className={labelMutedClass}>Administracion de empresa</p>
              <p className={`mt-1 text-sm ${textMutedClass}`}>
                Usuarios y operacion se administran dentro de esta empresa.
              </p>
            </div>
            <StatusPill active={selectedOrg.is_active} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-black bg-surface-card p-3">
              <p className={labelMutedClass}>Usuarios</p>
              <p className="mt-1 text-xl font-black text-slate-100">
                {selectedOrg.user_count}
              </p>
            </div>
            <div className="rounded-lg border border-black bg-surface-card p-3">
              <p className={labelMutedClass}>Bodegas</p>
              <p className="mt-1 flex items-center gap-1 text-xl font-black text-slate-100">
                <Warehouse className="h-4 w-4 text-emerald-300" />
                {selectedOrg.warehouse_count}
              </p>
            </div>
            <div className="rounded-lg border border-black bg-surface-card p-3">
              <p className={labelMutedClass}>Limites</p>
              <p className="mt-1 text-sm font-black text-slate-100">
                {selectedOrg.max_users ?? "-"} usuarios,{" "}
                {selectedOrg.max_warehouses ?? "-"} bodegas
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowEditOrg((open) => !open)}
              className={`${secondaryButtonClass} h-10 text-sm font-black`}
            >
              <Pencil className="h-4 w-4" />
              Editar empresa
            </button>
            <button
              type="button"
              onClick={() => void handleToggleActive()}
              disabled={saving}
              className={`${secondaryButtonClass} h-10 text-sm font-black disabled:opacity-40`}
            >
              {selectedOrg.is_active ? "Desactivar" : "Reactivar"}
            </button>
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className={dangerButtonClass}
            >
              <Trash2 className="h-4 w-4" />
          Cerrar y archivar
            </button>
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
    </>
  );
}
