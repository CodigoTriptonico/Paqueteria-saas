"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listOrgUsersAction,
  inviteOrgUserAction,
  updateOrgUserAction,
  type OrgUserRow,
} from "@/app/actions/users";
import { listRolesAndPermissionsAction, setRolePermissionAction } from "@/app/actions/roles";
import { listWarehousesAction } from "@/app/actions/warehouses";
import type { RoleSlug } from "@/lib/auth/types";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

const ROLE_OPTIONS: { slug: RoleSlug; label: string }[] = [
  { slug: "administrador", label: "Administrador" },
  { slug: "vendedor", label: "Vendedor" },
  { slug: "conductor", label: "Conductor" },
];

export function UsersSettingsPanel() {
  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [roles, setRoles] = useState<{ id: string; slug: RoleSlug; name: string }[]>([]);
  const [permissions, setPermissions] = useState<{ id: string; key: string; name: string }[]>([]);
  const [rolePermissions, setRolePermissions] = useState<
    { roleId: string; permissionId: string; key: string; granted: boolean }[]
  >([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState({
    email: "",
    password: "",
    fullName: "",
    roleSlug: "vendedor" as RoleSlug,
    warehouseIds: [] as string[],
  });

  async function reload() {
    const [usersResult, rolesResult, warehousesResult] = await Promise.all([
      listOrgUsersAction(),
      listRolesAndPermissionsAction(),
      listWarehousesAction(),
    ]);

    if (usersResult.ok) {
      setUsers(usersResult.data);
    }

    if (rolesResult.ok) {
      setRoles(rolesResult.data.roles);
      setPermissions(rolesResult.data.permissions);
      setRolePermissions(rolesResult.data.rolePermissions);
      setSelectedRoleId((current) => current || rolesResult.data.roles[0]?.id || "");
    }

    if (warehousesResult.ok) {
      setWarehouses(warehousesResult.data.filter((row) => row.is_active));
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, []);

  const selectedRolePermissions = useMemo(
    () => rolePermissions.filter((row) => row.roleId === selectedRoleId),
    [rolePermissions, selectedRoleId],
  );

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const result = await inviteOrgUserAction(invite);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setInvite({
      email: "",
      password: "",
      fullName: "",
      roleSlug: "vendedor",
      warehouseIds: [],
    });
    setMessage("Usuario creado");
    await reload();
  }

  async function togglePermission(permissionId: string, granted: boolean) {
    if (!selectedRoleId) {
      return;
    }

    const result = await setRolePermissionAction(selectedRoleId, permissionId, granted);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setRolePermissions((current) =>
      current.map((row) =>
        row.roleId === selectedRoleId && row.permissionId === permissionId
          ? { ...row, granted }
          : row,
      ),
    );
  }

  return (
    <div className="grid gap-6">
      <form className="grid gap-3 rounded-xl border border-black bg-surface-card p-4" onSubmit={handleInvite}>
        <p className="text-lg font-black">Invitar / crear usuario</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Correo"
            type="email"
            value={invite.email}
            onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))}
            required
          />
          <input
            className={inputClass}
            placeholder="Contrasena temporal"
            type="password"
            value={invite.password}
            onChange={(event) => setInvite((current) => ({ ...current, password: event.target.value }))}
            required
          />
          <input
            className={inputClass}
            placeholder="Nombre"
            value={invite.fullName}
            onChange={(event) => setInvite((current) => ({ ...current, fullName: event.target.value }))}
          />
          <select
            className={inputClass}
            value={invite.roleSlug}
            onChange={(event) =>
              setInvite((current) => ({ ...current, roleSlug: event.target.value as RoleSlug }))
            }
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role.slug} value={role.slug}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {warehouses.length ? (
          <div className="grid gap-2">
            <p className="text-sm font-black uppercase text-slate-400">Bodegas permitidas</p>
            <div className="flex flex-wrap gap-2">
              {warehouses.map((warehouse) => {
                const checked = invite.warehouseIds.includes(warehouse.id);

                return (
                  <label
                    key={warehouse.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
                      checked ? "border-emerald-600 bg-emerald-400 text-slate-950" : "border-black"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setInvite((current) => ({
                          ...current,
                          warehouseIds: checked
                            ? current.warehouseIds.filter((id) => id !== warehouse.id)
                            : [...current.warehouseIds, warehouse.id],
                        }))
                      }
                    />
                    {warehouse.name}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <button type="submit" className={primaryButtonClass}>
          Crear usuario
        </button>
      </form>

      <div className="grid gap-3">
        <p className="text-lg font-black">Usuarios de la empresa</p>
        {users?.map((user) => (
          <div
            key={user.id}
            className="grid gap-3 rounded-xl border border-black bg-surface-card p-4 md:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <p className="text-lg font-black">{user.full_name || user.email}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
              <p className="text-sm font-bold text-emerald-300">{user.role.name}</p>
              {user.warehouses.length ? (
                <p className="mt-1 text-xs text-slate-400">
                  Bodegas: {user.warehouses.map((warehouse) => warehouse.name).join(", ")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Todas las bodegas activas</p>
              )}
            </div>

            <select
              className={inputClass}
              value={user.role.slug}
              onChange={async (event) => {
                const result = await updateOrgUserAction({
                  userId: user.id,
                  roleSlug: event.target.value as RoleSlug,
                });

                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }

                await reload();
              }}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.slug} value={role.slug}>
                  {role.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={secondaryButtonClass}
              onClick={async () => {
                const result = await updateOrgUserAction({
                  userId: user.id,
                  isActive: !user.is_active,
                });

                if (!result.ok) {
                  setMessage(result.error);
                  return;
                }

                await reload();
              }}
            >
              {user.is_active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-black bg-surface-card p-4">
        <p className="text-lg font-black">Permisos por rol</p>
        <select
          className={inputClass}
          value={selectedRoleId}
          onChange={(event) => setSelectedRoleId(event.target.value)}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>

        <div className="grid gap-2">
          {permissions.map((permission) => {
            const state = selectedRolePermissions.find((row) => row.key === permission.key);
            const granted = state?.granted ?? false;

            return (
              <label
                key={permission.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-black bg-surface-panel px-3 py-2"
              >
                <span className="font-bold">{permission.name}</span>
                <input
                  type="checkbox"
                  checked={granted}
                  onChange={(event) => void togglePermission(permission.id, event.target.checked)}
                />
              </label>
            );
          })}
        </div>
      </div>

      {message ? <p className="text-sm font-bold text-emerald-300">{message}</p> : null}
    </div>
  );
}
