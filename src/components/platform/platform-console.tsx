"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createOrgUserAsPlatformAdminAction,
  createOrganizationAction,
  deactivateOrganizationAction,
  listAllOrganizationsAction,
  listOrganizationUsersAction,
  reactivateOrganizationAction,
  updateOrgUserAsPlatformAdminAction,
} from "@/app/actions/platform";
import {
  cardClass,
  inputClass,
  labelMutedClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
  textMutedClass,
} from "@/components/ui-blocks";
import type { PlatformOrganizationRow, PlatformOrgUserRow, RoleSlug } from "@/lib/auth/types";
import Link from "next/link";

const ROLE_OPTIONS: { slug: RoleSlug; label: string }[] = [
  { slug: "administrador", label: "Administrador" },
  { slug: "vendedor", label: "Vendedor" },
  { slug: "conductor", label: "Conductor" },
];

export function PlatformConsole() {
  const [organizations, setOrganizations] = useState<PlatformOrganizationRow[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [users, setUsers] = useState<PlatformOrgUserRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userRole, setUserRole] = useState<RoleSlug>("vendedor");

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
    const result = await listOrganizationUsersAction(organizationId);

    if (!result.ok) {
      setError(result.error);
      setUsers([]);
      return;
    }

    setUsers(result.data);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrganizations();
    });
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedOrgId) {
      return;
    }

    queueMicrotask(() => {
      void loadUsers(selectedOrgId);
    });
  }, [loadUsers, selectedOrgId]);

  const displayUsers = selectedOrgId ? users : [];

  async function handleCreateOrg(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const result = await createOrganizationAction({
      name: orgName,
      slug: orgSlug || undefined,
      adminEmail,
      adminPassword,
      adminFullName: adminFullName || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Empresa creada correctamente.");
    setShowCreateOrg(false);
    setOrgName("");
    setOrgSlug("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminFullName("");
    await loadOrganizations();
    setSelectedOrgId(result.data.organizationId);
  }

  async function handleToggleOrgActive(org: PlatformOrganizationRow) {
    setMessage("");
    setError("");

    const result = org.is_active
      ? await deactivateOrganizationAction(org.id)
      : await reactivateOrganizationAction(org.id);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(org.is_active ? "Empresa desactivada." : "Empresa reactivada.");
    await loadOrganizations();
  }

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      return;
    }

    setMessage("");
    setError("");

    const result = await createOrgUserAsPlatformAdminAction({
      organizationId: selectedOrgId,
      email: userEmail,
      password: userPassword,
      fullName: userFullName || undefined,
      roleSlug: userRole,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Usuario creado.");
    setShowCreateUser(false);
    setUserEmail("");
    setUserPassword("");
    setUserFullName("");
    setUserRole("vendedor");
    await loadUsers(selectedOrgId);
    await loadOrganizations();
  }

  async function toggleUserActive(user: PlatformOrgUserRow) {
    if (!selectedOrgId) {
      return;
    }

    const result = await updateOrgUserAsPlatformAdminAction({
      organizationId: selectedOrgId,
      userId: user.id,
      isActive: !user.is_active,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await loadUsers(selectedOrgId);
  }

  return (
    <Panel title="Plataforma" hideHeader>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={labelMutedClass}>Super-admin del SaaS</p>
          <h3 className="text-2xl font-black text-[#f8fafc]">Panel de plataforma</h3>
          <p className={textMutedClass}>
            Gestiona todas las paqueterías. La configuración habitual sigue siendo solo para tu empresa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={secondaryButtonClass}>
            App operativa
          </Link>
          <button type="button" className={primaryButtonClass} onClick={() => setShowCreateOrg(true)}>
            Nueva paquetería
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/30 px-3 py-2 text-sm font-bold text-emerald-200">
          {message}
        </p>
      ) : null}

      {showCreateOrg ? (
        <form
          onSubmit={(event) => void handleCreateOrg(event)}
          className={`${cardClass} mb-4 grid gap-3 p-4 md:grid-cols-2`}
        >
          <h4 className="md:col-span-2 text-lg font-black text-[#f8fafc]">Crear paquetería</h4>
          <label className="grid gap-1">
            <span className={labelMutedClass}>Nombre empresa</span>
            <input className={inputClass} value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className={labelMutedClass}>Slug (opcional)</span>
            <input className={inputClass} value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className={labelMutedClass}>Email admin inicial</span>
            <input
              className={inputClass}
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1">
            <span className={labelMutedClass}>Contraseña temporal</span>
            <input
              className={inputClass}
              type="password"
              minLength={6}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </label>
          <label className="md:col-span-2 grid gap-1">
            <span className={labelMutedClass}>Nombre admin</span>
            <input className={inputClass} value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} />
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className={primaryButtonClass}>
              Crear
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setShowCreateOrg(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-black bg-surface-card-header px-3 py-2">
            <p className="text-sm font-black uppercase text-slate-400">Empresas</p>
          </div>
          <div className="max-h-[32rem] overflow-y-auto p-2">
            {loading ? (
              <p className="p-3 text-sm font-bold text-slate-400">Cargando...</p>
            ) : organizations.length ? (
              organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`mb-2 w-full rounded-lg border px-3 py-3 text-left transition ${
                    selectedOrgId === org.id
                      ? "border-emerald-500 bg-emerald-950/30"
                      : "border-black bg-surface-inset hover:bg-surface-card-header"
                  }`}
                >
                  <p className="font-black text-[#f8fafc]">{org.name}</p>
                  <p className="text-xs font-bold text-slate-400">{org.slug}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {org.user_count} usuarios · {org.warehouse_count} bodegas ·{" "}
                    {org.is_active ? "Activa" : "Inactiva"}
                  </p>
                </button>
              ))
            ) : (
              <p className="p-3 text-sm font-bold text-slate-400">Sin empresas en la base de datos</p>
            )}
          </div>
        </div>

        <div className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black bg-surface-card-header px-3 py-2">
            <p className="text-sm font-black uppercase text-slate-400">
              {selectedOrg ? selectedOrg.name : "Detalle de empresa"}
            </p>
            {selectedOrg ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void handleToggleOrgActive(selectedOrg)}
                >
                  {selectedOrg.is_active ? "Desactivar" : "Reactivar"}
                </button>
                <button type="button" className={primaryButtonClass} onClick={() => setShowCreateUser(true)}>
                  Usuario
                </button>
              </div>
            ) : null}
          </div>

          {!selectedOrg ? (
            <p className="p-4 text-sm font-bold text-slate-400">Selecciona una empresa de la lista.</p>
          ) : (
            <div className="p-3">
              {showCreateUser ? (
                <form onSubmit={(event) => void handleCreateUser(event)} className="mb-4 grid gap-2 rounded-lg border border-black bg-surface-inset p-3">
                  <label className="grid gap-1">
                    <span className={labelMutedClass}>Email</span>
                    <input className={inputClass} type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
                  </label>
                  <label className="grid gap-1">
                    <span className={labelMutedClass}>Contraseña</span>
                    <input className={inputClass} type="password" minLength={6} value={userPassword} onChange={(e) => setUserPassword(e.target.value)} required />
                  </label>
                  <label className="grid gap-1">
                    <span className={labelMutedClass}>Nombre</span>
                    <input className={inputClass} value={userFullName} onChange={(e) => setUserFullName(e.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className={labelMutedClass}>Rol</span>
                    <select className={inputClass} value={userRole} onChange={(e) => setUserRole(e.target.value as RoleSlug)}>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.slug} value={role.slug}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className={primaryButtonClass}>
                      Crear usuario
                    </button>
                    <button type="button" className={secondaryButtonClass} onClick={() => setShowCreateUser(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="grid gap-2">
                {displayUsers.length ? (
                  displayUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2"
                    >
                      <div>
                        <p className="font-black text-[#f8fafc]">{user.email}</p>
                        <p className="text-xs font-bold text-slate-400">
                          {user.full_name || "—"} · {user.role.name}
                          {!user.is_active ? " · Inactivo" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void toggleUserActive(user)}
                      >
                        {user.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-slate-400">Sin usuarios en esta empresa</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
