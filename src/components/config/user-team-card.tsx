"use client";

import {
  Calendar,
  ChevronDown,
  Loader2,
  Mail,
  Phone,
  Shield,
  Truck,
  UserCog,
  Warehouse,
  X,
} from "lucide-react";
import type { OrgUserRow } from "@/app/actions/users";
import { UserWarehouseAccessEditor } from "@/components/config/user-warehouse-access-editor";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import type { RoleRow, RoleSlug } from "@/lib/auth/types";
import { formatPhoneForInput } from "@/lib/phone/format-input";
import { normalizePhoneDigits } from "@/lib/phone/normalize";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { settingsFieldLabelClass as fieldLabelClass } from "@/components/config/settings-panel-styles";

const ROLE_ICONS: Partial<Record<RoleSlug, typeof Shield>> = {
  administrador: Shield,
  vendedor: UserCog,
  conductor: Truck,
};

function userInitials(user: OrgUserRow) {
  const source = user.full_name?.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatUserCreatedAt(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDisplayPhone(phone: string) {
  const digits = normalizePhoneDigits(phone);

  if (digits.length < 10) {
    return phone.trim();
  }

  return formatPhoneForInput(digits, true);
}

function collectUserPhones(user: OrgUserRow) {
  const seen = new Set<string>();
  const phones: string[] = [];

  for (const raw of [user.phone, ...user.additionalPhones]) {
    const trimmed = raw.trim();

    if (!trimmed) {
      continue;
    }

    const key = normalizePhoneDigits(trimmed);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    phones.push(formatDisplayPhone(trimmed));
  }

  return phones;
}

function warehouseAccessLabel(user: OrgUserRow) {
  if (user.role.slug === "administrador") {
    return "Todas las bodegas";
  }

  if (!user.warehouses.length) {
    return "Sin acceso";
  }

  if (user.defaultWarehouseId) {
    const favorite = user.warehouses.find(
      (warehouse) => warehouse.id === user.defaultWarehouseId,
    );

    if (favorite) {
      const others = user.warehouses.length - 1;
      return others > 0 ? `${favorite.name} +${others}` : favorite.name;
    }
  }

  return user.warehouses.map((warehouse) => warehouse.name).join(", ");
}

function warehouseAccessHint(roleSlug: RoleSlug) {
  if (roleSlug === "administrador") {
    return "Acceso total por rol. No requiere asignación.";
  }

  return "Activa el acceso y elige una favorita si tiene varias.";
}

type UserTeamCardProps = {
  user: OrgUserRow;
  roles: RoleRow[];
  warehouses: { id: string; name: string; is_default: boolean }[];
  isExpanded: boolean;
  warehouseDraft: string[];
  preferredWarehouseDraft: string | null;
  savingUserId: string;
  onToggleWarehouses: () => void;
  onCloseWarehouses: () => void;
  onWarehouseDraftChange: (ids: string[]) => void;
  onPreferredChange: (id: string | null) => void;
  onSaveWarehouses: () => void;
  onRoleChange: (roleSlug: RoleSlug) => Promise<void>;
  onToggleActive: () => Promise<void>;
};

export function UserTeamCard({
  user,
  roles,
  warehouses,
  isExpanded,
  warehouseDraft,
  preferredWarehouseDraft,
  savingUserId,
  onToggleWarehouses,
  onCloseWarehouses,
  onWarehouseDraftChange,
  onPreferredChange,
  onSaveWarehouses,
  onRoleChange,
  onToggleActive,
}: UserTeamCardProps) {
  const RoleIcon = ROLE_ICONS[user.role.slug] || Shield;
  const phones = collectUserPhones(user);
  const warehouseLabel = warehouseAccessLabel(user);
  const noWarehouseAccess =
    !user.warehouses.length && user.role.slug !== "administrador";

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition hover:bg-surface-card-hover ${
        user.is_active ? "" : "border-rose-900/40 bg-rose-950/10"
      } ${isExpanded ? "bg-emerald-400/10" : ""}`}
    >
      <div className="border-b border-black/70 bg-gradient-to-br from-surface-card-header to-surface-card px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-400/20 to-surface-inset text-lg font-black text-emerald-200 shadow-inner">
              {userInitials(user)}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-card ${
                  user.is_active ? "bg-emerald-400" : "bg-slate-500"
                }`}
                aria-hidden
              />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="truncate text-lg font-black leading-tight text-[#f8fafc] sm:text-xl">
                {user.full_name || "Sin nombre"}
              </p>
              <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-slate-400">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span className="truncate">{user.email}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                user.is_active
                  ? "bg-emerald-400/20 text-emerald-200"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {user.is_active ? "Activo" : "Inactivo"}
            </span>
            {user.is_current_user ? (
              <span className="rounded-md border border-black/80 bg-surface-inset px-2 py-0.5 text-[10px] font-black uppercase text-slate-400">
                Tu cuenta
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-900/50 bg-sky-950/40 px-2.5 py-1 text-xs font-black text-sky-200">
            <RoleIcon className="h-3.5 w-3.5" aria-hidden />
            {user.role.name}
          </span>
          <span
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-black bg-surface-inset px-2.5 py-1 text-xs font-bold ${
              noWarehouseAccess ? "text-amber-200" : "text-slate-300"
            }`}
          >
            <Warehouse className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate">{warehouseLabel}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <label className={fieldLabelClass}>
          Rol
          <InlineSearchPicker
            compact={false}
            className="w-full"
            minWidthClass="w-full min-w-0"
            value={user.role.slug}
            disabled={user.is_current_user}
            onChange={(slug) => void onRoleChange(slug as RoleSlug)}
            options={roles.map((role) => ({
              value: role.slug,
              label: role.name,
            }))}
            placeholder="Elegir rol"
            searchPlaceholder="Buscar rol…"
            ariaLabel="Rol del usuario"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {warehouses.length ? (
            <button
              type="button"
              className={`${secondaryButtonClass} min-h-10 flex-1`}
              onClick={onToggleWarehouses}
            >
              Bodegas
              <ChevronDown
                className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}

          {!user.is_current_user ? (
            <button
              type="button"
              className={`${secondaryButtonClass} min-h-10 flex-1 ${
                user.is_active ? "text-rose-200" : "text-emerald-200"
              }`}
              onClick={() => void onToggleActive()}
            >
              {user.is_active ? "Desactivar" : "Activar"}
            </button>
          ) : null}
        </div>

        {isExpanded ? (
          <div className="mt-4 rounded-xl border border-black bg-surface-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase text-slate-400">
                  Acceso a bodegas
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {warehouseAccessHint(user.role.slug)}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black bg-surface-inset text-slate-400"
                onClick={onCloseWarehouses}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <UserWarehouseAccessEditor
                warehouses={warehouses}
                selectedIds={warehouseDraft}
                preferredId={preferredWarehouseDraft}
                isAdmin={user.role.slug === "administrador"}
                disabled={savingUserId === user.id}
                onSelectedChange={onWarehouseDraftChange}
                onPreferredChange={onPreferredChange}
              />
            </div>

            {user.role.slug !== "administrador" ? (
              <div className="mt-4 flex gap-2 border-t border-black/80 pt-4">
                <button
                  type="button"
                  className={`${primaryButtonClass} min-h-10 flex-1`}
                  disabled={savingUserId === user.id}
                  onClick={onSaveWarehouses}
                >
                  {savingUserId === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Guardar cambios"
                  )}
                </button>
                <button
                  type="button"
                  className={`${secondaryButtonClass} min-h-10`}
                  onClick={onCloseWarehouses}
                >
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="mt-auto border-t border-black/60 px-4 py-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold leading-relaxed text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            {phones.length ? phones.join(" · ") : "Sin teléfono"}
          </span>
          <span className="text-slate-700" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1 capitalize">
            <Calendar className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            Alta {formatUserCreatedAt(user.createdAt)}
          </span>
        </p>
      </footer>
    </article>
  );
}
