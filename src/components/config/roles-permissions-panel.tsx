"use client";

import {
  Crown,
  Loader2,
  Plus,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Trash2,
  Truck,
  UserCog,
} from "lucide-react";
import {
  InlineSearchCombobox,
} from "@/components/inline-search-picker";
import { useEffect, useMemo, useState } from "react";
import type { OrgUserRow } from "@/app/actions/users";
import {
  createRoleAction,
  addSuggestedRoleAction,
  deleteRoleAction,
  setRolePermissionAction,
  setRolePermissionsBatchAction,
  updateRoleAction,
  type RolePermissionState,
} from "@/app/actions/roles";
import type { RoleCatalogEntry } from "@/lib/auth/role-catalog";
import type { PermissionKey, PermissionRow, RoleRow } from "@/lib/auth/types";
import { CompactInfoDisclosure, inputClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { AddRoleModal } from "@/components/config/add-role-modal";
import { settingsSectionClass as sectionClass } from "@/components/config/settings-panel-styles";

const compactInputClass = `${inputClass} h-10`;

const PERMISSION_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  { title: "Ventas", keys: ["sales.manage", "customers.manage"] },
  {
    title: "Inventario",
    keys: ["inventory.view", "inventory.reserve", "inventory.adjust", "inventory.assign", "inventory.return", "warehouses.manage"],
  },
  { title: "Rutas", keys: ["routes.view", "routes.update_status"] },
  {
    title: "Administracion",
    keys: ["users.manage", "permissions.manage", "settings.manage"],
  },
];

const ROLE_META: Record<
  string,
  { icon: typeof Shield; hint: string }
> = {
  administrador: {
    icon: Crown,
    hint: "Gestión completa de la paquetería.",
  },
  vendedor: {
    icon: UserCog,
    hint: "Ventas, clientes e inventario operativo.",
  },
  conductor: {
    icon: Truck,
    hint: "Consulta rutas y actualiza entregas.",
  },
  logistica: {
    icon: Truck,
    hint: "Rutas, asignación y operaciones de entrega.",
  },
  bodega: {
    icon: Shield,
    hint: "Inventario y bodegas.",
  },
  finanzas: {
    icon: ShieldCheck,
    hint: "Cuentas, cobros y retención financiera.",
  },
  auditor: {
    icon: ShieldCheck,
    hint: "Consulta de auditoría y estados financieros.",
  },
  captador_distribuidores: {
    icon: UserCog,
    hint: "Alta y seguimiento de distribuidores.",
  },
  captador_agencias: {
    icon: UserCog,
    hint: "Crea y da soporte a agencias.",
  },
  supervisor_agencias: {
    icon: Crown,
    hint: "Supervisa captadores y soporte de agencias.",
  },
};

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
      className={`relative h-5 w-9 shrink-0 rounded-full border border-black p-0.5 transition disabled:opacity-50 ${
        checked ? "bg-emerald-400" : "bg-surface-inset"
      }`}
    >
      <span
        className={`block h-3.5 w-3.5 rounded-full bg-slate-950 transition ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function roleButtonClass(active: boolean) {
  return `flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
    active
      ? "border-black bg-emerald-400/10 hover:bg-emerald-400/15"
      : "border-black bg-surface-inset hover:bg-surface-card-hover"
  }`;
}

type RolesPermissionsPanelProps = {
  users: OrgUserRow[];
  roles: RoleRow[];
  permissions: PermissionRow[];
  rolePermissions: RolePermissionState[];
  suggestedRoles?: RoleCatalogEntry[];
  selectedRoleId: string;
  onSelectRole: (roleId: string) => void;
  onRolePermissionsChange: (next: RolePermissionState[]) => void;
  onReload: () => Promise<void>;
};

export function RolesPermissionsPanel({
  users,
  roles,
  permissions,
  rolePermissions,
  suggestedRoles = [],
  selectedRoleId,
  onSelectRole,
  onRolePermissionsChange,
  onReload,
}: RolesPermissionsPanelProps) {
  const notify = useNotify();
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [roleQuery, setRoleQuery] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [editRoleName, setEditRoleName] = useState("");
  const [busyGroup, setBusyGroup] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  useEffect(() => {
    if (!selectedRole) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setEditRoleName(selectedRole.name);
    });
    return () => {
      active = false;
    };
  }, [selectedRole]);

  const allPermission = permissions.find((permission) => permission.key === "all") || null;
  const roleIcons = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ROLE_META).map(([slug, meta]) => [slug, meta.icon]),
      ),
    [],
  );

  const usersByRole = useMemo(() => {
    const counts = new Map<string, number>();

    for (const user of users) {
      counts.set(user.role.id, (counts.get(user.role.id) || 0) + 1);
    }

    return counts;
  }, [users]);

  const selectedRolePermissions = useMemo(
    () => rolePermissions.filter((row) => row.roleId === selectedRoleId),
    [rolePermissions, selectedRoleId],
  );

  const grantedCount = selectedRolePermissions.filter((row) => row.granted).length;
  const hasFullAccess = allPermission
    ? Boolean(selectedRolePermissions.find((row) => row.key === "all")?.granted)
    : false;

  const systemRoles = roles.filter((role) => role.isSystem);
  const customRoles = roles.filter((role) => !role.isSystem);

  const filteredSystemRoles = useMemo(() => {
    const query = roleQuery.trim().toLowerCase();

    if (!query) {
      return systemRoles;
    }

    return systemRoles.filter((role) =>
      [role.name, role.slug, "base", "sistema"].join(" ").toLowerCase().includes(query),
    );
  }, [roleQuery, systemRoles]);

  const filteredCustomRoles = useMemo(() => {
    const query = roleQuery.trim().toLowerCase();

    if (!query) {
      return customRoles;
    }

    return customRoles.filter((role) =>
      [role.name, role.slug, "personalizado"].join(" ").toLowerCase().includes(query),
    );
  }, [customRoles, roleQuery]);

  const filteredRoleCount = filteredSystemRoles.length + filteredCustomRoles.length;
  const hasRoleSearch = roleQuery.trim().length > 0;

  const roleSearchOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: role.name,
        searchText: [role.name, role.slug, role.isSystem ? "sistema base" : "personalizado"]
          .join(" "),
      })),
    [roles],
  );

  const permissionSearchOptions = useMemo(
    () =>
      permissions.map((permission) => ({
        value: permission.id,
        label: permission.name,
        searchText: [permission.name, permission.description, permission.key]
          .filter(Boolean)
          .join(" "),
      })),
    [permissions],
  );

  const groupedPermissions = useMemo(() => {
    const usedKeys = new Set(PERMISSION_GROUPS.flatMap((group) => group.keys));
    if (allPermission) {
      usedKeys.add("all");
    }

    const byKey = new Map(permissions.map((permission) => [permission.key, permission]));
    const query = permissionQuery.trim().toLowerCase();

    const groups = PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: group.keys
        .map((key) => byKey.get(key))
        .filter(Boolean) as PermissionRow[],
    }))
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          if (!query) {
            return true;
          }

          const haystack = [permission.name, permission.description, permission.key]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        }),
      }))
      .filter((group) => group.permissions.length);

    const other = permissions.filter(
      (permission) => !usedKeys.has(permission.key),
    );

    const filteredOther = other.filter((permission) => {
      if (!query) {
        return true;
      }

      const haystack = [permission.name, permission.description, permission.key]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    return filteredOther.length
      ? [...groups, { title: "Otros", keys: [], permissions: filteredOther }]
      : groups;
  }, [allPermission, permissionQuery, permissions]);

  const roleMeta = selectedRole
    ? ROLE_META[selectedRole.slug] || { icon: ShieldCheck, hint: "Rol personalizado." }
    : null;
  const RoleIcon = roleMeta?.icon || ShieldCheck;
  const roleUserCount = selectedRole ? usersByRole.get(selectedRole.id) || 0 : 0;
  const progressPercent =
    permissions.length > 0 ? Math.round((grantedCount / permissions.length) * 100) : 0;

  function isPermissionGranted(permissionId: string) {
    return (
      selectedRolePermissions.find((row) => row.permissionId === permissionId)?.granted ?? false
    );
  }

  async function togglePermission(permissionId: string, granted: boolean) {
    if (!selectedRoleId) {
      return;
    }

    const result = await setRolePermissionAction(selectedRoleId, permissionId, granted);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    onRolePermissionsChange(
      rolePermissions.map((row) =>
        row.roleId === selectedRoleId && row.permissionId === permissionId
          ? { ...row, granted }
          : row,
      ),
    );
  }

  async function setGroupPermissions(
    groupTitle: string,
    groupPermissions: PermissionRow[],
    granted: boolean,
  ) {
    if (!selectedRoleId || !groupPermissions.length) {
      return;
    }

    setBusyGroup(groupTitle);

    const result = await setRolePermissionsBatchAction(
      selectedRoleId,
      groupPermissions.map((permission) => ({
        permissionId: permission.id,
        granted,
      })),
    );

    setBusyGroup("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    const permissionIds = new Set(groupPermissions.map((permission) => permission.id));
    onRolePermissionsChange(
      rolePermissions.map((row) =>
        row.roleId === selectedRoleId && permissionIds.has(row.permissionId)
          ? { ...row, granted }
          : row,
      ),
    );
  }

  async function createRole() {
    setRoleSaving(true);
    const result = await createRoleAction({
      name: newRoleName,
      copyFromRoleId: selectedRoleId || undefined,
    });
    setRoleSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setNewRoleName("");
    setShowAddRoleModal(false);
    onSelectRole(result.data.id);
    notify.success("Rol creado");
    await onReload();
  }

  async function addSuggestedRole(slug: string) {
    setRoleSaving(true);
    const result = await addSuggestedRoleAction(slug);
    setRoleSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setShowAddRoleModal(false);
    onSelectRole(result.data.id);
    notify.success(`${result.data.name} agregado`);
    await onReload();
  }

  async function renameRole() {
    if (!selectedRole || selectedRole.isSystem) {
      return;
    }

    setRoleSaving(true);
    const result = await updateRoleAction({ roleId: selectedRole.id, name: editRoleName });
    setRoleSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Rol actualizado");
    await onReload();
  }

  async function deleteRole() {
    if (!selectedRole || selectedRole.isSystem) {
      return;
    }

    setRoleSaving(true);
    const result = await deleteRoleAction(selectedRole.id);
    setRoleSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Rol eliminado");
    await onReload();
  }

  function renderRoleButton(role: RoleRow) {
    const active = selectedRoleId === role.id;
    const count = usersByRole.get(role.id) || 0;
    const roleGranted = rolePermissions.filter(
      (row) => row.roleId === role.id && row.granted,
    ).length;
    const Icon = ROLE_META[role.slug]?.icon || Shield;

    return (
      <button
        key={role.id}
        type="button"
        className={roleButtonClass(active)}
        onClick={() => onSelectRole(role.id)}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
            active
              ? "border-emerald-600 bg-emerald-400 text-slate-950"
              : "border-black bg-surface-card text-slate-300"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-black text-[#f8fafc]">{role.name}</span>
            {role.isSystem ? (
              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">
                base
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs font-bold text-slate-500">
            {count} {count === 1 ? "usuario" : "usuarios"} · {roleGranted}/{permissions.length}
          </span>
        </span>
      </button>
    );
  }

  return (
    <>
    <section className={sectionClass}>
      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-black xl:border-b-0 xl:border-r">
          <div className="border-b border-black bg-surface-card-header px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-wide text-slate-400">Roles</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {hasRoleSearch
                    ? `${filteredRoleCount} de ${roles.length} coincidencias`
                    : `${roles.length} ${roles.length === 1 ? "rol" : "roles"} en total`}
                </p>
              </div>
            </div>

            <InlineSearchCombobox
              value={roleQuery}
              onChange={setRoleQuery}
              options={roleSearchOptions}
              placeholder="Buscar rol..."
              emptyLabel="Sin roles"
              ariaLabel="Buscar roles"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              className="mt-3 w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => {
                const role = roles.find((entry) => entry.id === option.value);
                if (role) {
                  setRoleQuery(role.name);
                  onSelectRole(role.id);
                }
              }}
            />
          </div>

          <div className="max-h-[min(32rem,62vh)] space-y-4 overflow-y-auto p-4">
            {filteredRoleCount ? (
              <>
                {filteredSystemRoles.length ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase text-slate-500">Del sistema</p>
                    {filteredSystemRoles.map(renderRoleButton)}
                  </div>
                ) : null}

                {filteredCustomRoles.length ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase text-slate-500">
                      Personalizados
                    </p>
                    {filteredCustomRoles.map(renderRoleButton)}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-black bg-surface-inset px-3 py-8 text-center">
                <p className="text-sm font-black text-[#f8fafc]">Sin coincidencias</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Prueba otro nombre o limpia la búsqueda.
                </p>
                <button
                  type="button"
                  className={`${secondaryButtonClass} mt-3`}
                  onClick={() => setRoleQuery("")}
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}

            <button
              type="button"
              className={`${secondaryButtonClass} w-full justify-center gap-2`}
              onClick={() => {
                setNewRoleName("");
                setShowAddRoleModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Agregar rol
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          {selectedRole ? (
            <>
              <div className="border-b border-black bg-surface-card-header px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950">
                      <RoleIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-[#f8fafc]">{selectedRole.name}</h3>
                        {selectedRole.isSystem ? (
                          <span className="rounded-md border border-black bg-surface-inset px-2 py-0.5 text-[11px] font-black uppercase text-slate-400">
                            Rol base
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-400">{roleMeta?.hint}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {roleUserCount} {roleUserCount === 1 ? "usuario" : "usuarios"} con este
                        rol · {grantedCount}/{permissions.length} permisos activos
                      </p>
                    </div>
                  </div>

                  <span className="rounded-md border border-black bg-surface-inset px-3 py-1.5 text-sm font-black tabular-nums text-emerald-300">
                    {progressPercent}%
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full border border-black bg-surface-inset">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4 p-4">
                {allPermission ? (
                  <div
                    className={`rounded-xl border px-4 py-3 ${
                      hasFullAccess
                        ? "border-amber-500/40 bg-amber-950/25"
                        : "border-black bg-surface-panel"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#f8fafc]">Acceso completo</p>
                        <p className="mt-1 text-sm font-bold leading-snug text-slate-400">
                          {allPermission.description ||
                            "Otorga todos los permisos sin excepción. Usar solo en administradores."}
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={hasFullAccess}
                        onChange={(checked) => void togglePermission(allPermission.id, checked)}
                      />
                    </div>
                  </div>
                ) : null}

                <InlineSearchCombobox
                  value={permissionQuery}
                  onChange={setPermissionQuery}
                  options={permissionSearchOptions}
                  placeholder="Buscar permiso..."
                  emptyLabel="Sin permisos"
                  ariaLabel="Buscar permisos"
                  leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                  className="w-full"
                  minWidthClass="w-full min-w-0"
                  onSelectOption={(option) => {
                    const permission = permissions.find((entry) => entry.id === option.value);
                    if (permission) {
                      setPermissionQuery(permission.name);
                    }
                  }}
                />

                {groupedPermissions.length ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {groupedPermissions.map((group) => {
                      const activeInGroup = group.permissions.filter((permission) =>
                        isPermissionGranted(permission.id),
                      ).length;
                      const allActive = activeInGroup === group.permissions.length;
                      const groupBusy = busyGroup === group.title;

                      return (
                        <article
                          key={group.title}
                          className="rounded-xl border border-black bg-surface-panel p-3"
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-black text-[#f8fafc]">{group.title}</p>
                              <p className="text-xs font-bold text-slate-500">
                                {activeInGroup}/{group.permissions.length} activos
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={groupBusy}
                              className="text-xs font-black text-emerald-300 underline-offset-2 hover:underline disabled:opacity-50"
                              onClick={() =>
                                void setGroupPermissions(
                                  group.title,
                                  group.permissions,
                                  !allActive,
                                )
                              }
                            >
                              {groupBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : allActive ? (
                                "Desactivar grupo"
                              ) : (
                                "Activar grupo"
                              )}
                            </button>
                          </div>

                          <div className="space-y-2">
                            {group.permissions.map((permission) => {
                              const granted = isPermissionGranted(permission.id);

                              return (
                                <label
                                  key={permission.id}
                                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${
                                    granted
                                      ? "border-emerald-700/40 bg-emerald-400/10"
                                      : "border-black bg-surface-inset"
                                  }`}
                                >
                                  <span className="min-w-0 pr-2">
                                    <span className="block text-sm font-black text-[#f8fafc]">
                                      {permission.name}
                                    </span>
                                    {permission.description ? (
                                      <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-500">
                                        {permission.description}
                                      </span>
                                    ) : null}
                                  </span>
                                  <ToggleSwitch
                                    checked={granted}
                                    onChange={(checked) =>
                                      void togglePermission(permission.id, checked)
                                    }
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-black bg-surface-inset px-4 py-8 text-center text-sm font-bold text-slate-400">
                    Ningún permiso coincide con la búsqueda.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="px-4 py-16 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-base font-black text-[#f8fafc]">Selecciona un rol</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-black">
        {!selectedRole?.isSystem && selectedRole ? (
          <div className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black text-[#f8fafc]">Editar rol personalizado</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {selectedRole.name} · no es un rol base
              </p>
              <input
                className={`${compactInputClass} mt-3 w-full max-w-md`}
                value={editRoleName}
                onChange={(event) => setEditRoleName(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={!editRoleName.trim() || roleSaving}
                onClick={() => void renameRole()}
              >
                Guardar nombre
              </button>
              <button
                type="button"
                className={`${secondaryButtonClass} gap-1.5 text-rose-200`}
                disabled={roleSaving || roleUserCount > 0}
                title={
                  roleUserCount > 0 ? "Reasigna los usuarios antes de eliminar" : undefined
                }
                onClick={() => void deleteRole()}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
            {roleUserCount > 0 ? (
              <p className="text-xs font-bold text-amber-200/90 lg:col-span-2">
                Hay {roleUserCount} usuario(s) con este rol. Cámbiales el rol antes de
                eliminarlo.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 text-left">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-slate-400">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="block text-sm font-black text-[#f8fafc]">Roles base</span>
              <CompactInfoDisclosure ariaLabel="Cómo agregar roles">
                Usa Agregar rol para abrir el modal de sugeridos o personalizados.
              </CompactInfoDisclosure>
            </span>
          </div>
        )}
      </div>
    </section>

    <AddRoleModal
      open={showAddRoleModal}
      suggestedRoles={suggestedRoles}
      selectedRoleName={selectedRole?.name}
      newRoleName={newRoleName}
      roleSaving={roleSaving}
      roleIcons={roleIcons}
      onClose={() => {
        if (roleSaving) {
          return;
        }
        setShowAddRoleModal(false);
        setNewRoleName("");
      }}
      onNewRoleNameChange={setNewRoleName}
      onAddSuggested={(slug) => void addSuggestedRole(slug)}
      onCreateCustom={() => void createRole()}
    />
    </>
  );
}
