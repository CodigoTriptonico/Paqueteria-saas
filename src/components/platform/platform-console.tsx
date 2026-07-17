"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Hash,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Store,
  Trash2,
  Truck,
  User,
  UserPlus,
  Warehouse,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { enterClientOrganizationAction } from "@/app/actions/act-as";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import {
  createOrgUserAsPlatformAdminAction,
  deactivateOrganizationAction,
  deleteOrganizationAction,
  deleteOrgUserAsPlatformAdminAction,
  listAllOrganizationsAction,
  listOrganizationUsersAction,
  reactivateOrganizationAction,
  updateOrganizationAction,
  updateOrgUserAsPlatformAdminAction,
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
import type { PlatformOrganizationRow, PlatformOrgUserRow, RoleSlug } from "@/lib/auth/types";

const ROLE_OPTIONS: { slug: RoleSlug; label: string }[] = [
  { slug: "administrador", label: "Administrador" },
  { slug: "vendedor", label: "Vendedor" },
  { slug: "conductor", label: "Conductor" },
];

type StatusFilter = "all" | "active" | "inactive";
type OrgContextMenu = {
  x: number;
  y: number;
  org: PlatformOrganizationRow;
};

const ORGS_PER_PAGE = 3;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

const employeeCardClass =
  "border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:bg-surface-card-hover";
const dangerButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-black bg-[#3A1818] px-3 py-2 text-sm font-black text-rose-100 transition hover:bg-[#4A2020] disabled:cursor-not-allowed disabled:opacity-40";
const dangerConfirmButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-black bg-[#7F1D1D] px-3 py-2 text-sm font-black text-rose-100 transition hover:bg-[#991B1B] disabled:cursor-not-allowed disabled:opacity-40";

function platformOrgCardClass(orgId: string, selectedOrgId: string | null) {
  const selected = selectedOrgId === orgId;
  const groupHasSelection = selectedOrgId !== null;

  return selectionSurfaceClass(selected, groupHasSelection && !selected);
}

function employeeCountLabel(count: number) {
  return `${count} ${count === 1 ? "empleado" : "empleados"}`;
}

function hasStaleWarehouseContract(org: PlatformOrganizationRow) {
  return (
    org.max_warehouses !== null && org.warehouse_count > org.max_warehouses
  );
}

function filterChipClass(active: boolean) {
  return `h-8 shrink-0 rounded-md border px-2.5 text-xs font-black transition ${
    active
      ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
      : "border-black bg-surface-inset text-slate-400 hover:bg-surface-card-hover hover:text-slate-200"
  }`;
}

const ROLE_ICONS: Record<RoleSlug, LucideIcon> = {
  administrador: Shield,
  vendedor: Store,
  conductor: Truck,
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${
        active
          ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
          : "border-rose-700 bg-rose-950/40 text-rose-200"
      }`}
    >
      {active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function FieldLabel({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className={`${labelMutedClass} inline-flex items-center gap-1.5`}>
      <Icon className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
      {children}
    </span>
  );
}

function EmployeeListSkeleton({ rows }: { rows: number }) {
  const count = Math.max(1, Math.min(rows, 3));

  return (
    <div className="grid gap-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`employee-skeleton-${index}`}
          className="h-[7.75rem] animate-pulse rounded-xl border border-black bg-surface-inset"
        />
      ))}
    </div>
  );
}

export function PlatformConsole() {
  const router = useRouter();
  const notify = useNotify();
  const [organizations, setOrganizations] = useState<PlatformOrganizationRow[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [users, setUsers] = useState<PlatformOrgUserRow[]>([]);
  const [usersOrgId, setUsersOrgId] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const selectedOrgIdRef = useRef<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [orgPage, setOrgPage] = useState(0);

  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);

  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgSlug, setEditOrgSlug] = useState("");
  const [editMaxUsers, setEditMaxUsers] = useState(5);
  const [editMaxWarehouses, setEditMaxWarehouses] = useState(5);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userRole, setUserRole] = useState<RoleSlug>("vendedor");

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserRole, setEditUserRole] = useState<RoleSlug>("vendedor");
  const [enteringOrg, setEnteringOrg] = useState(false);
  const [deleteConfirmOrg, setDeleteConfirmOrg] = useState(false);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [orgContextMenu, setOrgContextMenu] = useState<OrgContextMenu | null>(null);

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId) || null;

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await listAllOrganizationsAction();

    if (!result.ok) {
      setError(result.error);
      setOrganizations([]);
      setLoading(false);
      return;
    }

    setOrganizations(result.data);
    setLoading(false);
  }, []);

  const loadUsers = useCallback(async (organizationId: string) => {
    setUsersLoading(true);

    const result = await listOrganizationUsersAction(organizationId);

    if (selectedOrgIdRef.current !== organizationId) {
      return;
    }

    setUsersLoading(false);

    if (!result.ok) {
      setError(result.error);
      setUsers([]);
      setUsersOrgId(organizationId);
      return;
    }

    setUsers(result.data);
    setUsersOrgId(organizationId);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrganizations();
    });
  }, [loadOrganizations]);

  useEffect(() => {
    selectedOrgIdRef.current = selectedOrgId;
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId) {
      queueMicrotask(() => {
        setUsers([]);
        setUsersOrgId(null);
        setUsersLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      void loadUsers(selectedOrgId);
    });
  }, [loadUsers, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrg) {
      return;
    }

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
        !search || org.name.toLowerCase().includes(search) || org.slug.toLowerCase().includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && org.is_active) ||
        (statusFilter === "inactive" && !org.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [organizations, query, statusFilter]);

  const orgSearchOptions = useMemo(
    () =>
      organizations.map((org) => ({
        value: org.id,
        label: org.name,
        searchText: `${org.name} ${org.slug}`,
      })),
    [organizations],
  );

  const platformRoleOptions = useMemo(
    () => ROLE_OPTIONS.map((role) => ({ value: role.slug, label: role.label })),
    [],
  );

  const orgPageCount = Math.max(1, Math.ceil(filteredOrganizations.length / ORGS_PER_PAGE));
  const safeOrgPage = Math.min(orgPage, orgPageCount - 1);
  const visibleOrganizations = useMemo(() => {
    const start = safeOrgPage * ORGS_PER_PAGE;

    return filteredOrganizations.slice(start, start + ORGS_PER_PAGE);
  }, [filteredOrganizations, safeOrgPage]);

  useEffect(() => {
    queueMicrotask(() => {
      setOrgPage(0);
    });
  }, [query, statusFilter]);

  function selectOrg(orgId: string) {
    if (orgId === selectedOrgId) {
      return;
    }

    const scrollY = window.scrollY;

    setSelectedOrgId(orgId);
    setShowEditOrg(false);
    setShowCreateUser(false);
    setEditingUserId(null);
    setDeleteConfirmOrg(false);
    setDeleteConfirmUserId(null);
    setUsersLoading(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    });
  }

  function openOrgContextMenu(event: MouseEvent, org: PlatformOrganizationRow) {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 224;
    const menuHeight = 188;
    const gap = 10;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - gap);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - gap);

    setOrgContextMenu({
      x: Math.max(gap, x),
      y: Math.max(gap, y),
      org,
    });
  }

  function closeOrgContextMenu() {
    setOrgContextMenu(null);
  }

  function editOrgFromMenu(org: PlatformOrganizationRow) {
    selectOrg(org.id);
    setShowEditOrg(true);
    setShowCreateUser(false);
    setEditingUserId(null);
    setDeleteConfirmOrg(false);
    closeOrgContextMenu();
  }

  function confirmDeleteOrgFromMenu(org: PlatformOrganizationRow) {
    selectOrg(org.id);
    setDeleteConfirmOrg(true);
    setDeleteConfirmUserId(null);
    setShowEditOrg(false);
    closeOrgContextMenu();
  }

  useEffect(() => {
    if (!orgContextMenu) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeOrgContextMenu();
      }
    }

    window.addEventListener("pointerdown", closeOrgContextMenu);
    window.addEventListener("scroll", closeOrgContextMenu, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeOrgContextMenu);
      window.removeEventListener("scroll", closeOrgContextMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [orgContextMenu]);

  function openCreateOrg() {
    setError("");
    setShowCreateOrg(true);
  }

  const closeCreateOrg = useCallback(() => {
    setShowCreateOrg(false);
  }, []);

  async function handleUpdateOrg(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrg) {
      return;
    }

    setError("");

    const result = await updateOrganizationAction({
      organizationId: selectedOrg.id,
      name: editOrgName,
      slug: editOrgSlug,
      maxUsers: editMaxUsers,
      maxWarehouses: editMaxWarehouses,
    });

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Cliente actualizado.");
    setShowEditOrg(false);
    await loadOrganizations();
  }

  async function handleEnterOrg(organizationId: string) {
    setError("");
    setEnteringOrg(true);

    try {
      const result = await enterClientOrganizationAction(organizationId);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      router.replace(result.data.redirectTo);
      router.refresh();
    } finally {
      setEnteringOrg(false);
    }
  }

  async function handleToggleOrgActive(org: PlatformOrganizationRow) {
    setError("");

    const result = org.is_active
      ? await deactivateOrganizationAction(org.id)
      : await reactivateOrganizationAction(org.id);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success(org.is_active ? "Cliente desactivado." : "Cliente reactivado.");
    await loadOrganizations();
    if (selectedOrgId) {
      await loadUsers(selectedOrgId);
    }
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      return;
    }

    setError("");

    const result = await createOrgUserAsPlatformAdminAction({
      organizationId: selectedOrgId,
      email: userEmail,
      password: userPassword,
      fullName: userFullName || undefined,
      roleSlug: userRole,
    });

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Usuario creado.");
    setShowCreateUser(false);
    setUserEmail("");
    setUserPassword("");
    setUserFullName("");
    setUserRole("vendedor");
    await loadUsers(selectedOrgId);
    await loadOrganizations();
  }

  function startEditUser(user: PlatformOrgUserRow) {
    setEditingUserId(user.id);
    setEditUserFullName(user.full_name || "");
    setEditUserRole(user.role.slug);
  }

  async function handleUpdateUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !editingUserId) {
      return;
    }

    setError("");

    const result = await updateOrgUserAsPlatformAdminAction({
      organizationId: selectedOrgId,
      userId: editingUserId,
      fullName: editUserFullName,
      roleSlug: editUserRole,
    });

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Usuario actualizado.");
    setEditingUserId(null);
    await loadUsers(selectedOrgId);
  }

  async function handleDeleteOrg() {
    if (!selectedOrg) {
      return;
    }

    setError("");
    setDeletingOrg(true);

    try {
      const result = await deleteOrganizationAction(selectedOrg.id);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      notify.success(`Paquetería «${selectedOrg.name}» cerrada y archivada con su historial.`);
      setDeleteConfirmOrg(false);
      setSelectedOrgId(null);
      setUsers([]);
      setUsersOrgId(null);
      await loadOrganizations();
    } finally {
      setDeletingOrg(false);
    }
  }

  async function handleDeleteUser(user: PlatformOrgUserRow) {
    if (!selectedOrgId) {
      return;
    }

    setError("");
    setDeletingUserId(user.id);

    try {
      const result = await deleteOrgUserAsPlatformAdminAction({
        organizationId: selectedOrgId,
        userId: user.id,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      notify.success("Acceso del empleado archivado; su historial se conservó.");
      setDeleteConfirmUserId(null);
      if (editingUserId === user.id) {
        setEditingUserId(null);
      }
      await loadUsers(selectedOrgId);
      await loadOrganizations();
    } finally {
      setDeletingUserId(null);
    }
  }

  async function toggleUserActive(user: PlatformOrgUserRow) {
    if (!selectedOrgId) {
      return;
    }

    setError("");

    const result = await updateOrgUserAsPlatformAdminAction({
      organizationId: selectedOrgId,
      userId: user.id,
      isActive: !user.is_active,
    });

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success(user.is_active ? "Usuario desactivado." : "Usuario activado.");
    await loadUsers(selectedOrgId);
    await loadOrganizations();
  }

  const platformNavTitle = useMemo(() => {
    if (showCreateOrg) {
      return "Nueva paquetería";
    }

    if (showCreateUser) {
      return "Nuevo usuario";
    }

    if (editingUserId) {
      return "Editar usuario";
    }

    if (selectedOrg) {
      return selectedOrg.name;
    }

    return "Plataforma";
  }, [editingUserId, selectedOrg, showCreateOrg, showCreateUser]);

  const handlePlatformNavBack = useCallback(() => {
    if (showCreateOrg) {
      closeCreateOrg();
      return;
    }

    if (showCreateUser) {
      setShowCreateUser(false);
      return;
    }

    if (editingUserId) {
      setEditingUserId(null);
      return;
    }

    if (selectedOrgId) {
      setSelectedOrgId(null);
      setUsers([]);
      setUsersOrgId(null);
      setEditingUserId(null);
    }
  }, [
    closeCreateOrg,
    editingUserId,
    selectedOrgId,
    showCreateOrg,
    showCreateUser,
  ]);

  useContextNav({
    title: platformNavTitle,
    onBack: handlePlatformNavBack,
  });

  if (loading) {
    return (
      <Panel title="Clientes">
        <p className="motion-enter-top flex items-center gap-2 text-sm font-bold text-emerald-300">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </p>
      </Panel>
    );
  }

  if (showCreateOrg) {
    return (
      <>
        {error ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        <div className="flex min-h-[calc(100dvh-7rem)] w-full flex-1 flex-col">
        <PlatformCreateClientWizard
          onCancel={closeCreateOrg}
          onError={(text) => notify.error(text)}
          onCreated={async (organizationId, summary) => {
            notify.success(summary);
            setShowCreateOrg(false);
            setSelectedOrgId(organizationId);
            await loadOrganizations();
          }}
        />
        </div>
      </>
    );
  }

  return (
    <>
      <Panel
        title={
          <span className="flex w-full min-w-0 items-center justify-between gap-3">
            <span className="truncate">Clientes</span>
            <button
              type="button"
              onClick={openCreateOrg}
              className={`${primaryButtonClass} shrink-0`}
            >
              <Plus className="h-4 w-4" />
              Nueva paquetería
            </button>
          </span>
        }
      >
        {error ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <InlineSearchCombobox
            value={query}
            onChange={(value) => {
              setQuery(value);
              setOrgPage(0);
            }}
            options={orgSearchOptions}
            placeholder="Buscar paquetería"
            emptyLabel="Sin clientes"
            ariaLabel="Buscar empresa"
            leadingIcon={<Search className="h-4 w-4" aria-hidden />}
            className="min-w-0 flex-1"
            minWidthClass="w-full min-w-0"
            onSelectOption={(option) => {
              const org = organizations.find((entry) => entry.id === option.value);
              if (org) {
                setQuery(org.name);
                setOrgPage(0);
              }
            }}
          />
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={statusFilter === option.value}
                className={filterChipClass(statusFilter === option.value)}
                onClick={() => {
                  setStatusFilter(option.value);
                  setOrgPage(0);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="mb-3 flex justify-start">
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOrgPage((current) => Math.max(0, current - 1))}
                disabled={safeOrgPage === 0 || filteredOrganizations.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600"
                aria-label="Clientes anteriores"
                title="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[3.25rem] rounded-md border border-black bg-surface-card px-2 py-1 text-center text-xs font-black text-[#f8fafc]">
                {filteredOrganizations.length ? safeOrgPage + 1 : 0}/
                {filteredOrganizations.length ? orgPageCount : 0}
              </span>
              <button
                type="button"
                onClick={() => setOrgPage((current) => Math.min(orgPageCount - 1, current + 1))}
                disabled={filteredOrganizations.length === 0 || safeOrgPage >= orgPageCount - 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600"
                aria-label="Clientes siguientes"
                title="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {visibleOrganizations.length ? (
              visibleOrganizations.map((org) => {
                const staleContract = hasStaleWarehouseContract(org);

                return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => selectOrg(org.id)}
                  onContextMenu={(event) => openOrgContextMenu(event, org)}
                  className={`relative overflow-hidden rounded-xl p-4 text-left shadow-none ${platformOrgCardClass(
                    org.id,
                    selectedOrgId,
                  )}${staleContract ? " border-amber-500/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3 pl-1">
                    <div>
                      <p className="text-2xl font-black">{org.name}</p>
                      {!org.is_active ? (
                        <p className="text-sm font-bold text-rose-300">Inactiva</p>
                      ) : staleContract ? (
                        <p className="text-sm font-bold text-amber-300">
                          Contrato desactualizado
                        </p>
                      ) : null}
                    </div>
                    <StatusPill active={org.is_active} />
                  </div>
                  <p className="mt-3 rounded-lg border border-black bg-surface-inset px-3 py-2 font-black text-[#f8fafc]">
                    {employeeCountLabel(org.user_count)}
                  </p>
                  <p
                    className={`mt-2 text-xs font-bold ${
                      staleContract ? "text-amber-300" : "text-slate-400"
                    }`}
                  >
                    Bodegas: {org.warehouse_count}
                    {org.max_warehouses !== null ? ` / ${org.max_warehouses} máx.` : " · sin límite"}
                  </p>
                </button>
              );
              })
            ) : (
              <div className="md:col-span-2 2xl:col-span-3">
                <div className="rounded-xl border border-dashed border-black bg-surface-inset px-6 py-10 text-center">
                  <Building2 className="mx-auto h-10 w-10 text-slate-500" aria-hidden />
                  <p className="mt-3 text-xl font-black text-[#f8fafc]">
                    {organizations.length ? "Sin coincidencias" : "Aún no hay paqueterías"}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm font-bold text-slate-400">
                    {organizations.length
                      ? "Prueba otro término de búsqueda o cambia el filtro."
                      : "Registra la primera empresa cliente con su dueño y credenciales de acceso."}
                  </p>
                  {!organizations.length ? (
                    <button type="button" className={`${primaryButtonClass} mt-4`} onClick={openCreateOrg}>
                      <Plus className="h-4 w-4" />
                      Nueva paquetería
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {orgContextMenu ? (
        <div
          role="menu"
          className="fixed z-50 w-56 overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ left: orgContextMenu.x, top: orgContextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-black px-3 py-2">
            <p className="truncate text-sm font-black text-[#f8fafc]">{orgContextMenu.org.name}</p>
            <p className="text-xs font-bold text-slate-400">{employeeCountLabel(orgContextMenu.org.user_count)}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-slate-100 hover:bg-surface-card-hover disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!orgContextMenu.org.is_active || enteringOrg}
            onClick={() => {
              const orgId = orgContextMenu.org.id;
              closeOrgContextMenu();
              void handleEnterOrg(orgId);
            }}
          >
            <LogIn className="h-4 w-4 text-emerald-300" />
            Operar
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-slate-100 hover:bg-surface-card-hover"
            onClick={() => editOrgFromMenu(orgContextMenu.org)}
          >
            <Pencil className="h-4 w-4 text-slate-300" />
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-slate-100 hover:bg-surface-card-hover"
            onClick={() => {
              const org = orgContextMenu.org;
              closeOrgContextMenu();
              void handleToggleOrgActive(org);
            }}
          >
            {orgContextMenu.org.is_active ? (
              <XCircle className="h-4 w-4 text-rose-300" />
            ) : (
              <RotateCcw className="h-4 w-4 text-emerald-300" />
            )}
            {orgContextMenu.org.is_active ? "Desactivar" : "Reactivar"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-black px-3 py-2 text-left text-sm font-black text-rose-200 hover:bg-[#3A1818]"
            onClick={() => confirmDeleteOrgFromMenu(orgContextMenu.org)}
          >
            <Trash2 className="h-4 w-4" />
            Cerrar y archivar
          </button>
        </div>
      ) : null}

      {selectedOrg ? (
        <section className="mt-4 scroll-mt-24 rounded-xl border border-black bg-surface-panel p-5 shadow-md sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black">{selectedOrg.name}</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">{employeeCountLabel(selectedOrg.user_count)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill active={selectedOrg.is_active} />
              <button
                type="button"
                className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-40`}
                disabled={!selectedOrg.is_active || enteringOrg}
                title={selectedOrg.is_active ? "Entrar a esta paquetería" : "Reactiva la paquetería para operar"}
                onClick={() => void handleEnterOrg(selectedOrg.id)}
              >
                {enteringOrg ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {enteringOrg ? "Entrando…" : "Operar"}
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void handleToggleOrgActive(selectedOrg)}
              >
                {selectedOrg.is_active ? <XCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                {selectedOrg.is_active ? "Desactivar" : "Reactivar"}
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setShowEditOrg((value) => !value);
                  setShowCreateUser(false);
                  setEditingUserId(null);
                  setDeleteConfirmOrg(false);
                }}
              >
                <Pencil className="h-4 w-4" />
                {showEditOrg ? "Cerrar" : "Editar empresa"}
              </button>
              {deleteConfirmOrg ? (
                <>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={deletingOrg}
                    onClick={() => setDeleteConfirmOrg(false)}
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={dangerConfirmButtonClass}
                    disabled={deletingOrg}
                    onClick={() => void handleDeleteOrg()}
                  >
                    {deletingOrg ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Archivar empresa
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => {
                    setDeleteConfirmOrg(true);
                    setDeleteConfirmUserId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Cerrar y archivar
                </button>
              )}
            </div>
          </div>

          <div>
              {showEditOrg ? (
                <form
                  onSubmit={(event) => void handleUpdateOrg(event)}
                  className="mb-6 grid gap-3 rounded-lg border border-emerald-700/50 bg-emerald-950/15 p-4 md:grid-cols-2"
                >
                  <p className="flex items-center gap-2 font-black text-emerald-100 md:col-span-2">
                    <Pencil className="h-4 w-4" aria-hidden />
                    Editar empresa
                  </p>
                  <label className="grid gap-1">
                    <FieldLabel icon={Building2}>Empresa</FieldLabel>
                    <input
                      className={inputClass}
                      value={editOrgName}
                      onChange={(e) => setEditOrgName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel icon={Hash}>Slug</FieldLabel>
                    <input
                      className={inputClass}
                      value={editOrgSlug}
                      onChange={(e) => setEditOrgSlug(e.target.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel icon={Building2}>Usuarios extra máx.</FieldLabel>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      max={500}
                      value={editMaxUsers}
                      onChange={(event) =>
                        setEditMaxUsers(Number(event.target.value) || 1)
                      }
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel icon={Warehouse}>Bodegas máximas</FieldLabel>
                    <input
                      className={inputClass}
                      type="number"
                      min={Math.max(1, selectedOrg?.warehouse_count || 1)}
                      max={100}
                      value={editMaxWarehouses}
                      onChange={(event) =>
                        setEditMaxWarehouses(Number(event.target.value) || 1)
                      }
                      required
                    />
                  </label>
                  {selectedOrg &&
                  selectedOrg.warehouse_count > editMaxWarehouses ? (
                    <p className="md:col-span-2 rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-xs font-bold leading-snug text-amber-100">
                      Ya hay {selectedOrg.warehouse_count} bodegas creadas. El límite
                      no puede quedar en {editMaxWarehouses}; al guardar se subirá al
                      menos a {selectedOrg.warehouse_count}.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <button type="submit" className={primaryButtonClass}>
                      <Save className="h-4 w-4" />
                      Guardar
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => {
                        setShowEditOrg(false);
                        setEditOrgName(selectedOrg.name);
                        setEditOrgSlug(selectedOrg.slug);
                        setEditMaxUsers(selectedOrg.max_users ?? 5);
                        setEditMaxWarehouses(selectedOrg.max_warehouses ?? 5);
                      }}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className={`${textMutedClass} flex items-center gap-2`}>
                  Empleados ({selectedOrg.user_count})
                  {usersLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden />
                  ) : null}
                </p>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => {
                    setShowCreateUser((value) => !value);
                    setShowEditOrg(false);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              {showCreateUser ? (
                <form
                  onSubmit={(event) => void handleCreateUser(event)}
                  className="mb-4 grid gap-3 rounded-lg border border-sky-700/50 bg-sky-950/15 p-4 md:grid-cols-2"
                >
                  <p className="flex items-center gap-2 font-black text-sky-100 md:col-span-2">
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Nuevo usuario
                  </p>
                  <label className="grid gap-1">
                    <FieldLabel icon={Mail}>Email</FieldLabel>
                    <input
                      className={inputClass}
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel icon={Lock}>Password</FieldLabel>
                    <input
                      className={inputClass}
                      type="password"
                      minLength={6}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel icon={User}>Nombre</FieldLabel>
                    <input
                      className={inputClass}
                      value={userFullName}
                      onChange={(e) => setUserFullName(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1">
                    <FieldLabel icon={Shield}>Rol</FieldLabel>
                    <InlineSearchPicker
                      compact={false}
                      className="w-full"
                      minWidthClass="w-full min-w-0"
                      value={userRole}
                      onChange={(slug) => setUserRole(slug as RoleSlug)}
                      options={platformRoleOptions}
                      placeholder="Elegir rol"
                      searchPlaceholder="Buscar rol…"
                      ariaLabel="Rol del usuario"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <button type="submit" className={primaryButtonClass}>
                      <UserPlus className="h-4 w-4" />
                      Crear usuario
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={() => setShowCreateUser(false)}>
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              {usersLoading && usersOrgId !== selectedOrg.id ? (
                <EmployeeListSkeleton rows={selectedOrg.user_count} />
              ) : users.length ? (
                <div className="grid gap-2">
                  {users.map((user) => {
                    const RoleIcon = ROLE_ICONS[user.role.slug];

                    return (
                      <div
                        key={user.id}
                        className={`relative overflow-hidden rounded-xl border px-4 py-3 ${employeeCardClass} ${
                          user.is_active ? "" : "bg-rose-950/15"
                        }`}
                      >
                        {editingUserId === user.id ? (
                          <form onSubmit={(event) => void handleUpdateUser(event)} className="grid gap-3">
                            <label className="grid gap-1">
                              <FieldLabel icon={User}>Nombre</FieldLabel>
                              <input
                                className={inputClass}
                                value={editUserFullName}
                                onChange={(e) => setEditUserFullName(e.target.value)}
                              />
                            </label>
                            <label className="grid gap-1">
                              <FieldLabel icon={Shield}>Rol</FieldLabel>
                              <InlineSearchPicker
                                compact={false}
                                className="w-full"
                                minWidthClass="w-full min-w-0"
                                value={editUserRole}
                                onChange={(slug) => setEditUserRole(slug as RoleSlug)}
                                options={platformRoleOptions}
                                placeholder="Elegir rol"
                                searchPlaceholder="Buscar rol…"
                                ariaLabel="Rol del usuario"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button type="submit" className={primaryButtonClass}>
                                <Save className="h-4 w-4" />
                                Guardar
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                onClick={() => setEditingUserId(null)}
                              >
                                <X className="h-4 w-4" />
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-xl font-black">{user.email}</span>
                              <StatusPill active={user.is_active} />
                            </span>
                            <span className="mt-1 block text-sm font-bold text-slate-400">
                              {user.full_name || "Sin nombre"}
                            </span>
                            <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-black bg-surface-inset px-2 py-0.5 text-[11px] font-black text-sky-200">
                              <RoleIcon className="h-3 w-3" aria-hidden />
                              {user.role.name}
                            </span>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                onClick={() => {
                                  setDeleteConfirmUserId(null);
                                  startEditUser(user);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClass}
                                onClick={() => {
                                  setDeleteConfirmUserId(null);
                                  void toggleUserActive(user);
                                }}
                              >
                                {user.is_active ? (
                                  <XCircle className="h-4 w-4" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                {user.is_active ? "Desactivar" : "Activar"}
                              </button>
                              {deleteConfirmUserId === user.id ? (
                                <>
                                  <button
                                    type="button"
                                    className={secondaryButtonClass}
                                    disabled={deletingUserId === user.id}
                                    onClick={() => setDeleteConfirmUserId(null)}
                                  >
                                    <X className="h-4 w-4" />
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className={dangerConfirmButtonClass}
                                    disabled={deletingUserId === user.id}
                                    onClick={() => void handleDeleteUser(user)}
                                  >
                                    {deletingUserId === user.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                    Archivar empleado
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className={dangerButtonClass}
                                  onClick={() => {
                                    setDeleteConfirmOrg(false);
                                    setDeleteConfirmUserId(user.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Archivar acceso
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-black bg-surface-card p-4 text-xl font-black">
                  Sin empleados
                </div>
              )}
          </div>
        </section>
      ) : null}
    </>
  );
}
