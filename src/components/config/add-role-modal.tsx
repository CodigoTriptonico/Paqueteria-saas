"use client";

import { Loader2, Plus, Shield, X } from "lucide-react";
import { useEffect, useRef, type ComponentType } from "react";
import { createPortal } from "react-dom";
import type { RoleCatalogEntry } from "@/lib/auth/role-catalog";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

const compactInputClass = `${inputClass} h-10`;

type RoleIcon = ComponentType<{ className?: string }>;

type AddRoleModalProps = {
  open: boolean;
  suggestedRoles: RoleCatalogEntry[];
  selectedRoleName?: string;
  newRoleName: string;
  roleSaving: boolean;
  roleIcons: Record<string, RoleIcon>;
  onClose: () => void;
  onNewRoleNameChange: (value: string) => void;
  onAddSuggested: (slug: string) => void;
  onCreateCustom: () => void;
};

export function AddRoleModal({
  open,
  suggestedRoles,
  selectedRoleName,
  newRoleName,
  roleSaving,
  roleIcons,
  onClose,
  onNewRoleNameChange,
  onAddSuggested,
  onCreateCustom,
}: AddRoleModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !roleSaving) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, roleSaving]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="app-modal-overlay fixed inset-0 z-[140] flex justify-center bg-black/70 p-3 sm:p-4">
      <div
        className="app-modal-content flex max-h-[min(40rem,92vh)] w-full max-w-lg flex-col rounded-xl border border-black bg-surface-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-role-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-black px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-500">Roles y permisos</p>
            <h3 id="add-role-modal-title" className="text-2xl font-black text-[#f8fafc]">
              Agregar rol
            </h3>
            <p className="mt-1 text-sm font-bold text-slate-400">
              Elige un sugerido o crea uno personalizado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={roleSaving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Roles sugeridos</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Opcionales, con permisos listos.
            </p>
            {suggestedRoles.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {suggestedRoles.map((entry) => {
                  const Icon = roleIcons[entry.slug] || Shield;
                  return (
                    <button
                      key={entry.slug}
                      type="button"
                      disabled={roleSaving}
                      onClick={() => onAddSuggested(entry.slug)}
                      className="flex items-start gap-3 rounded-xl border border-black bg-surface-card px-3 py-3 text-left transition hover:border-emerald-400 hover:bg-emerald-400/10 disabled:opacity-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-[#f8fafc]">{entry.name}</span>
                        <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-500">
                          {entry.hint}
                        </span>
                      </span>
                      <Plus className="mt-1 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-black bg-surface-inset px-3 py-3 text-sm font-bold text-slate-400">
                Ya agregaste todos los roles sugeridos.
              </p>
            )}
          </div>

          <div className="border-t border-black pt-4">
            <p className="text-xs font-black uppercase text-slate-500">Rol personalizado</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Hereda permisos de{" "}
              <span className="text-slate-300">{selectedRoleName || "el rol actual"}</span>.
            </p>
            <label className="mt-3 grid gap-1.5">
              <span className="sr-only">Nombre del rol</span>
              <input
                ref={inputRef}
                className={compactInputClass}
                placeholder="Ej: Supervisor de bodega"
                value={newRoleName}
                disabled={roleSaving}
                onChange={(event) => onNewRoleNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newRoleName.trim()) {
                    event.preventDefault();
                    onCreateCustom();
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-2 border-t border-black px-4 py-4 sm:grid-cols-2 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={roleSaving}
            className={`${secondaryButtonClass} h-11 disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!newRoleName.trim() || roleSaving}
            onClick={onCreateCustom}
            className={`${primaryButtonClass} h-11 gap-2 disabled:opacity-40`}
          >
            {roleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear rol
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
