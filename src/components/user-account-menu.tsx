"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { exitClientOrganizationAction } from "@/app/actions/act-as";
import { signOutAction } from "@/app/actions/auth";
import { platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";

function initialsFromSession(session: AppSession) {
  const source = session.fullName?.trim() || session.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

type UserAccountMenuProps = {
  session: AppSession | null;
  variant?: "bar" | "sidebar";
};

export function UserAccountMenu({ session, variant = "bar" }: UserAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayName = useMemo(() => {
    if (!session) return "";
    return session.fullName?.trim() || session.email.split("@")[0];
  }, [session]);

  const primaryLine = session?.isActingAsClient
    ? session.actingOrganizationName || session.organizationName
    : displayName;

  const secondaryLine = session?.isActingAsClient ? displayName : session?.roleName || "";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!session) {
    return null;
  }

  const initials = initialsFromSession(session);
  const isSidebar = variant === "sidebar";
  const settingsLocked = platformAdminNeedsClientContext(session);
  const settingsLockedHint = "Selecciona una paquetería en Plataforma y pulsa Operar";

  const triggerClass = isSidebar
    ? "flex w-full items-center gap-3 overflow-hidden rounded-lg border border-black bg-surface-card px-3 py-2.5 text-left transition-colors hover:bg-[#2f3834]"
    : "flex items-center gap-2 overflow-hidden rounded-lg border border-black bg-surface-card px-2 py-1.5 pr-3 transition-colors hover:bg-[#2f3834] sm:gap-3 sm:px-3 sm:py-2";

  return (
    <div ref={rootRef} className={`relative ${isSidebar ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu de cuenta"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black bg-emerald-600 text-sm font-black text-white"
          aria-hidden
        >
          {initials}
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-emerald-200">{primaryLine}</span>
          <span className="block truncate text-xs text-slate-400">{secondaryLine}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute z-[200] overflow-hidden rounded-lg border border-black bg-surface-panel shadow-lg ${
            isSidebar ? "bottom-full left-0 right-0 mb-2" : "right-0 top-full mt-2 w-72"
          }`}
        >
          <div className="border-b border-black/40 bg-surface-card px-4 py-3">
            {session.isActingAsClient ? (
              <>
                <p className="truncate text-sm font-black text-emerald-200">
                  {session.actingOrganizationName}
                </p>
                <p className="truncate text-xs text-slate-400">Vista de paquetería cliente</p>
                <p className="mt-2 truncate text-sm font-black text-slate-100">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{session.email}</p>
              </>
            ) : (
              <>
                <p className="truncate text-sm font-black text-slate-100">{displayName}</p>
                <p className="truncate text-xs text-slate-400">{session.email}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{session.organizationName}</p>
              </>
            )}
          </div>

          <div className="grid gap-1 p-2">
            {session.isActingAsClient ? (
              <form action={exitClientOrganizationAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-amber-200 transition-colors hover:bg-amber-950/40"
                >
                  <X className="h-4 w-4 shrink-0" />
                  Salir de esta paquetería
                </button>
              </form>
            ) : null}
            {settingsLocked ? (
              <span
                role="menuitem"
                title={settingsLockedHint}
                className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-500 opacity-60"
                aria-disabled="true"
              >
                <User className="h-4 w-4 shrink-0 text-slate-500" />
                Mi perfil
              </span>
            ) : (
              <Link
                href="/configuracion"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-surface-card"
              >
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                Mi perfil
              </Link>
            )}
            {settingsLocked ? (
              <span
                role="menuitem"
                title={settingsLockedHint}
                className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-500 opacity-60"
                aria-disabled="true"
              >
                <Settings className="h-4 w-4 shrink-0 text-slate-500" />
                Configuracion
              </span>
            ) : (
              <Link
                href="/configuracion"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-surface-card"
              >
                <Settings className="h-4 w-4 shrink-0 text-slate-400" />
                Configuracion
              </Link>
            )}
            {session.isPlatformAdmin && !session.isActingAsClient ? (
              <Link
                href="/platform"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-emerald-200 transition-colors hover:bg-emerald-950/30"
              >
                Panel plataforma
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-red-300 transition-colors hover:bg-red-950/40"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Cerrar sesion
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
