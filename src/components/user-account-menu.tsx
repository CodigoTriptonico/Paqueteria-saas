"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { actionConfirmButtonClass } from "@/components/action-confirm-dialog";
import { secondaryButtonClass } from "@/components/ui-blocks";
import type { AppSession } from "@/lib/auth/types";
import { useNotify } from "@/hooks/use-notify";
import {
  clearConductorOfflineUserData,
  clearConductorPrivateCache,
  countUnconfirmedConductorOperations,
} from "@/lib/conductor-offline/queue";

function initialsFromSession(session: AppSession) {
  const source = session.fullName?.trim() || session.email;
  const parts = source.split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : source.slice(0, 2).toUpperCase();
}

type UserAccountMenuProps = {
  session: AppSession | null;
  variant?: "bar" | "sidebar" | "rail";
};

export function UserAccountMenu({
  session,
  variant = "bar",
}: UserAccountMenuProps) {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = useMemo(
    () =>
      session ? session.fullName?.trim() || session.email.split("@")[0] : "",
    [session],
  );

  useEffect(() => {
    if (!open && !signOutConfirmOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (signOutConfirmOpen) {
        setSignOutConfirmOpen(false);
      } else {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, signOutConfirmOpen]);

  async function handleSignOut() {
    if (!session) return;
    setSigningOut(true);
    try {
      const pendingCount = await countUnconfirmedConductorOperations(
        session.organizationId,
        session.userId,
      );
      if (pendingCount > 0) {
        notify.error(
          `No puedes cerrar sesion: ${pendingCount} ${pendingCount === 1 ? "entrega sigue" : "entregas siguen"} pendiente de sincronizar`,
        );
        setSignOutConfirmOpen(false);
        return;
      }
      await clearConductorPrivateCache();
      await clearConductorOfflineUserData(
        session.organizationId,
        session.userId,
      );
      await signOutAction();
    } finally {
      setSigningOut(false);
    }
  }

  if (!session) return null;

  const isSidebar = variant === "sidebar";
  const isRail = variant === "rail";
  const triggerClass = isRail
    ? "flex w-full items-center justify-center rounded-lg border border-black bg-surface-card p-2 transition-colors hover:bg-[#2f3834]"
    : isSidebar
      ? "flex w-full items-center gap-3 overflow-hidden rounded-lg border border-black bg-surface-card px-3 py-2.5 text-left transition-colors hover:bg-[#2f3834]"
      : "flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-black bg-surface-card p-0 transition-colors hover:bg-[#2f3834] sm:h-auto sm:w-auto sm:gap-3 sm:px-3 sm:py-2";
  const menuPositionClass = isRail
    ? "left-full top-0 ml-2 w-72"
    : isSidebar
      ? "bottom-full left-0 right-0 mb-2"
      : "right-0 top-full mt-2 w-72";

  return (
    <div
      ref={rootRef}
      className={`relative ${isSidebar || isRail ? "w-full" : ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu de cuenta"
        title={isRail ? displayName : undefined}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black bg-emerald-600 text-sm font-black text-white"
          aria-hidden
        >
          {session.avatarUrl ? (
            // Signed Supabase URLs cannot be covered by a static remote image allow list.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsFromSession(session)
          )}
        </span>
        {isRail ? null : (
          <>
            <span className="relative hidden min-w-0 flex-1 sm:block">
              <span className="block truncate text-sm font-black text-emerald-200">
                {displayName}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {session.roleName}
              </span>
            </span>
            <ChevronDown
              className={`hidden h-4 w-4 shrink-0 text-slate-400 transition-transform sm:block ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={`absolute z-[200] overflow-hidden rounded-lg border border-black bg-surface-panel shadow-lg ${menuPositionClass}`}
        >
          <div className="border-b border-black/40 bg-surface-card px-4 py-3 text-center">
            <p className="truncate text-sm font-black text-slate-100">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-400">{session.email}</p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {session.organizationName}
            </p>
          </div>
          <div className="grid gap-1 p-2">
            <Link
              href="/perfil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-surface-card"
            >
              <User className="h-4 w-4 shrink-0 text-slate-400" />
              Mi perfil
            </Link>
            {session.isPlatformAdmin ? (
              <Link
                href="/platform"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-emerald-200 transition-colors hover:bg-emerald-950/30"
              >
                Panel plataforma
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setSignOutConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold text-red-300 transition-colors hover:bg-red-950/40"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Cerrar sesion
            </button>
          </div>
        </div>
      ) : null}

      {signOutConfirmOpen ? (
        <div className="app-modal-overlay fixed inset-0 z-[210] flex justify-center bg-black/70 p-3 sm:p-4">
          <button
            type="button"
            aria-label="Cancelar cierre de sesion"
            className="absolute inset-0"
            disabled={signingOut}
            onClick={() => setSignOutConfirmOpen(false)}
          />
          <div
            className="app-modal-content relative w-full max-w-sm rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-out-confirm-title"
          >
            <p
              id="sign-out-confirm-title"
              className="text-xl font-black text-[#f8fafc]"
            >
              Cerrar sesion?
            </p>
            <p className="mt-2 break-words text-sm font-bold text-slate-400">
              Saldras de la cuenta de {displayName}. Tendras que volver a
              iniciar sesion para entrar.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(false)}
                disabled={signingOut}
                className={`${secondaryButtonClass} h-11 text-sm font-black disabled:opacity-40`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className={actionConfirmButtonClass("danger")}
              >
                {signingOut ? "Cerrando..." : "Cerrar sesion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
