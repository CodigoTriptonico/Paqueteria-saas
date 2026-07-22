"use client";

import {
  Loader2,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  listOrgUsersAction,
  inviteOrgUserAction,
  updateOrgUserAction,
  type OrgUserRow,
} from "@/app/actions/users";
import { listRolesAndPermissionsAction, type RolePermissionState } from "@/app/actions/roles";
import { getOrganizationPlanLimitsAction } from "@/app/actions/organization";
import { PlanUsageLink } from "@/components/config/plan-usage-link";
import { UserTeamCard } from "@/components/config/user-team-card";
import { UserWarehouseAccessEditor } from "@/components/config/user-warehouse-access-editor";
import { RolesPermissionsPanel } from "@/components/config/roles-permissions-panel";
import type { RoleCatalogEntry } from "@/lib/auth/role-catalog";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import { listWarehousesAction } from "@/app/actions/warehouses";
import { PageLoading } from "@/components/page-loading";
import type { PermissionRow, RoleRow, RoleSlug } from "@/lib/auth/types";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import { useNotify } from "@/hooks/use-notify";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { formatPersonNameInput } from "@/lib/person-name";
import {
  settingsFieldLabelClass as fieldLabelClass,
  settingsIconBoxClass as iconBoxClass,
  settingsSectionClass as sectionClass,
  settingsSectionHeaderClass as sectionHeaderClass,
  settingsSectionTitleClass as sectionTitleClass,
} from "@/components/config/settings-panel-styles";

type UsersTab = "team" | "roles";

const usersTabs: AppTabDefinition<UsersTab>[] = [
  { id: "team", label: "Equipo", icon: Users },
  { id: "roles", label: "Roles y permisos", icon: Shield },
];

const compactInputClass = `${inputClass} h-10`;

function warehouseAccessHint(roleSlug: RoleSlug) {
  if (roleSlug === "administrador") {
    return "Acceso total por rol. No requiere asignación.";
  }

  return "Activa el acceso y elige una favorita si tiene varias.";
}

export function UsersSettingsPanel() {
  const notify = useNotify();
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<UsersTab>("team");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [warehouseDraft, setWarehouseDraft] = useState<string[]>([]);
  const [preferredWarehouseDraft, setPreferredWarehouseDraft] = useState<string | null>(
    null,
  );
  const [savingUserId, setSavingUserId] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionState[]>([]);
  const [suggestedRoles, setSuggestedRoles] = useState<RoleCatalogEntry[]>([]);
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; is_default: boolean }[]
  >([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [planMaxUsers, setPlanMaxUsers] = useState<number | null>(null);
  const [invite, setInvite] = useState({
    email: "",
    password: generateTemporaryPassword(),
    fullName: "",
    roleSlug: "vendedor" as RoleSlug,
    warehouseIds: [] as string[],
    preferredWarehouseId: null as string | null,
  });

  async function reload() {
    const [usersResult, rolesResult, warehousesResult, planResult] = await Promise.all([
      listOrgUsersAction(),
      listRolesAndPermissionsAction(),
      listWarehousesAction(),
      getOrganizationPlanLimitsAction(),
    ]);

    if (usersResult.ok) {
      setUsers(usersResult.data);
    }

    if (rolesResult.ok) {
      setRoles(rolesResult.data.roles);
      setPermissions(rolesResult.data.permissions);
      setRolePermissions(rolesResult.data.rolePermissions);
      setSuggestedRoles(rolesResult.data.suggestedRoles);
      setSelectedRoleId((current) => current || rolesResult.data.roles[0]?.id || "");
    }

    if (warehousesResult.ok) {
      setWarehouses(warehousesResult.data.filter((row) => row.is_active));
    }

    if (planResult.ok) {
      setPlanMaxUsers(planResult.data.maxUsers);
    }

    setLoaded(true);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  const extraUserCount = Math.max(0, users.length - 1);
  const atUserLimit = planMaxUsers !== null && extraUserCount >= planMaxUsers;
  const remainingUsers =
    planMaxUsers !== null ? Math.max(0, planMaxUsers - extraUserCount) : null;

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const haystack = [user.full_name, user.email, user.role.name, user.role.slug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [userQuery, users]);

  const userSearchOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: user.full_name || user.email,
        searchText: [user.full_name, user.email, user.role.name, user.role.slug]
          .filter(Boolean)
          .join(" "),
      })),
    [users],
  );

  const rolePickerOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.slug,
        label: role.name,
      })),
    [roles],
  );

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteSaving(true);

    const result = await inviteOrgUserAction({
      email: invite.email,
      password: invite.password,
      fullName: invite.fullName,
      roleSlug: invite.roleSlug,
      warehouseIds: invite.roleSlug === "administrador" ? [] : invite.warehouseIds,
      defaultWarehouseId: invite.preferredWarehouseId,
    });

    setInviteSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setInvite({
      email: "",
      password: generateTemporaryPassword(),
      fullName: "",
      roleSlug: "vendedor",
      warehouseIds: [],
      preferredWarehouseId: null,
    });
    setShowInviteForm(false);
    notify.success("Usuario creado");
    await reload();
  }

  function openWarehouseEditor(user: OrgUserRow) {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(user.id);
    setWarehouseDraft(user.warehouses.map((warehouse) => warehouse.id));
    setPreferredWarehouseDraft(user.defaultWarehouseId);
  }

  async function saveWarehouseAccess(userId: string, isAdmin: boolean) {
    setSavingUserId(userId);

    const result = await updateOrgUserAction({
      userId,
      warehouseIds: isAdmin ? undefined : warehouseDraft,
      defaultWarehouseId: isAdmin ? undefined : preferredWarehouseDraft,
    });

    setSavingUserId("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Acceso a bodegas actualizado");
    setExpandedUserId(null);
    await reload();
  }

  if (!loaded) {
    return <PageLoading />;
  }

  const inviteModal = showInviteForm ? (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      onClick={() => setShowInviteForm(false)}
    >
      <form
        className="max-h-[min(90dvh,40rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-black bg-surface-card shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
        onSubmit={handleInvite}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black bg-surface-card-header px-5 py-4">
          <p className="text-sm font-black text-[#f8fafc]">Nuevo usuario</p>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-slate-400"
            onClick={() => setShowInviteForm(false)}
            aria-label="Cerrar formulario"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className={fieldLabelClass}>
              Correo
              <input
                className={compactInputClass}
                placeholder="correo@empresa.com"
                type="email"
                value={invite.email}
                onChange={(event) =>
                  setInvite((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </label>
            <label className={fieldLabelClass}>
              Contrasena temporal
              <div className="flex gap-2">
                <input
                  className={`${compactInputClass} min-w-0 flex-1 font-mono text-sm`}
                  type="text"
                  value={invite.password}
                  onChange={(event) =>
                    setInvite((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                />
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() =>
                    setInvite((current) => ({
                      ...current,
                      password: generateTemporaryPassword(),
                    }))
                  }
                >
                  Nueva
                </button>
              </div>
            </label>
            <label className={fieldLabelClass}>
              Nombre
              <input
                className={compactInputClass}
                placeholder="Nombre completo"
                value={invite.fullName}
                onChange={(event) =>
                  setInvite((current) => ({
                    ...current,
                    fullName: formatPersonNameInput(event.target.value),
                  }))
                }
              />
            </label>
            <label className={fieldLabelClass}>
              Rol
              <InlineSearchPicker
                compact={false}
                className="w-full"
                minWidthClass="w-full min-w-0"
                value={invite.roleSlug}
                onChange={(slug) =>
                  setInvite((current) => ({
                    ...current,
                    roleSlug: slug as RoleSlug,
                  }))
                }
                options={rolePickerOptions}
                placeholder="Elegir rol"
                searchPlaceholder="Buscar rol…"
                ariaLabel="Rol del usuario"
              />
            </label>
          </div>

          {warehouses.length ? (
            <div className="mt-3 grid gap-2">
              <p className="text-[11px] font-black uppercase text-slate-400">
                Acceso a bodegas
              </p>
              <p className="text-xs font-bold text-slate-500">
                {warehouseAccessHint(invite.roleSlug)}
              </p>
              <UserWarehouseAccessEditor
                warehouses={warehouses}
                selectedIds={invite.warehouseIds}
                preferredId={invite.preferredWarehouseId}
                isAdmin={invite.roleSlug === "administrador"}
                onSelectedChange={(warehouseIds) =>
                  setInvite((current) => ({ ...current, warehouseIds }))
                }
                onPreferredChange={(preferredWarehouseId) =>
                  setInvite((current) => ({ ...current, preferredWarehouseId }))
                }
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={atUserLimit || inviteSaving}
              className={`${primaryButtonClass} gap-2`}
            >
              {inviteSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Crear usuario
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setShowInviteForm(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  ) : null;

  return (
    <>
    <div className="grid w-full gap-4">
      <AppTabs
        tabs={usersTabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Secciones de usuarios"
      />

      {activeTab === "team" ? (
        <>
          <section className={sectionClass}>
            <div className={`${sectionHeaderClass} flex-col items-stretch gap-3 sm:flex-row sm:items-center`}>
              <div className="min-w-0">
                <p className={sectionTitleClass}>
                  <span className={iconBoxClass}>
                    <Users className="h-4 w-4" />
                  </span>
                  Usuarios ({users.length})
                </p>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
                <InlineSearchCombobox
                  value={userQuery}
                  onChange={setUserQuery}
                  options={userSearchOptions}
                  placeholder="Buscar por nombre, correo o rol"
                  emptyLabel="Sin usuarios"
                  ariaLabel="Buscar usuarios"
                  leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                  className="min-w-0 flex-1"
                  minWidthClass="w-full min-w-0"
                  onSelectOption={(option) => {
                    const user = users.find((entry) => entry.id === option.value);
                    if (user) {
                      setUserQuery(user.full_name || user.email);
                    }
                  }}
                />
                <button
                  type="button"
                  className={`${primaryButtonClass} h-10 shrink-0 gap-1.5 px-5`}
                  disabled={atUserLimit}
                  onClick={() => setShowInviteForm(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Agregar usuario
                </button>
              </div>
            </div>

            {atUserLimit ? (
              <p className="border-b border-black/80 px-4 py-2.5 text-xs font-bold text-amber-200/90">
                Límite del plan alcanzado. No puedes crear más usuarios hasta ampliar el contrato.
              </p>
            ) : remainingUsers === 1 ? (
              <p className="border-b border-black/80 px-4 py-2.5 text-xs font-bold text-slate-400">
                Queda 1 usuario adicional disponible en el plan.
              </p>
            ) : null}

            <div className="p-4 sm:p-5">
              {filteredUsers.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredUsers.map((user) => (
                    <UserTeamCard
                      key={user.id}
                      user={user}
                      roles={roles}
                      warehouses={warehouses}
                      isExpanded={expandedUserId === user.id}
                      warehouseDraft={warehouseDraft}
                      preferredWarehouseDraft={preferredWarehouseDraft}
                      savingUserId={savingUserId}
                      onToggleWarehouses={() => openWarehouseEditor(user)}
                      onCloseWarehouses={() => setExpandedUserId(null)}
                      onWarehouseDraftChange={setWarehouseDraft}
                      onPreferredChange={setPreferredWarehouseDraft}
                      onSaveWarehouses={() => void saveWarehouseAccess(user.id, false)}
                      onRoleChange={async (roleSlug) => {
                        const result = await updateOrgUserAction({
                          userId: user.id,
                          roleSlug,
                        });

                        if (!result.ok) {
                          notify.error(result.error);
                          return;
                        }

                        notify.success("Rol actualizado");
                        await reload();
                      }}
                      onToggleActive={async () => {
                        const result = await updateOrgUserAction({
                          userId: user.id,
                          isActive: !user.is_active,
                        });

                        if (!result.ok) {
                          notify.error(result.error);
                          return;
                        }

                        notify.success(
                          user.is_active ? "Usuario desactivado" : "Usuario activado",
                        );
                        await reload();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-black bg-surface-inset px-6 py-14 text-center">
                  <Users className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="mt-4 text-xl font-black text-[#f8fafc]">
                    {userQuery.trim() ? "Sin coincidencias" : "Solo el dueño por ahora"}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm font-bold text-slate-400">
                    {userQuery.trim()
                      ? "Prueba otro término de búsqueda."
                      : "Agrega empleados para que operen ventas, inventario o rutas."}
                  </p>
                  {!userQuery.trim() && !showInviteForm && !atUserLimit ? (
                    <button
                      type="button"
                      className={`${primaryButtonClass} mt-5 gap-2`}
                      onClick={() => setShowInviteForm(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Agregar usuario
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-black/80 px-4 py-3 text-sm font-bold text-slate-400">
              <span className={atUserLimit ? "text-amber-300" : undefined}>
                {planMaxUsers === null
                  ? `${extraUserCount} adicionales · sin límite`
                  : `${extraUserCount} / ${planMaxUsers} adicionales`}
              </span>
              <span className="text-slate-600">·</span>
              <PlanUsageLink />
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "roles" ? (
        <RolesPermissionsPanel
          users={users}
          roles={roles}
          permissions={permissions}
          rolePermissions={rolePermissions}
          suggestedRoles={suggestedRoles}
          selectedRoleId={selectedRoleId}
          onSelectRole={(roleId) => setSelectedRoleId(roleId)}
          onRolePermissionsChange={setRolePermissions}
          onReload={reload}
        />
      ) : null}
    </div>
    {mounted && inviteModal ? createPortal(inviteModal, document.body) : null}
    </>
  );
}
