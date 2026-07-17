"use client";

import {
  BadgeCheck,
  Camera,
  Check,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  changeMyPasswordAction,
  updateMyProfileAction,
  uploadMyProfileAvatarAction,
} from "@/app/actions/profile";
import { useSetShellConfig } from "@/components/app-frame";
import {
  cardClass,
  iconWellEmerald,
  inputClass,
  labelMutedClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";

function initials(fullName: string, email: string) {
  const parts = (fullName || email).trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (parts[0] || "?").slice(0, 2).toUpperCase();
}

type ProfileAccountClientProps = {
  initialAvatarUrl: string | null;
  session: {
    fullName: string | null;
    email: string;
    organizationName: string;
    roleName: string;
    permissions: string[];
  };
};

export function ProfileAccountClient({ initialAvatarUrl, session }: ProfileAccountClientProps) {
  const notify = useNotify();
  const router = useRouter();
  const setShellConfig = useSetShellConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(session.fullName || "");
  const [savedName, setSavedName] = useState(session.fullName || "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", nextPassword: "", confirmation: "" });

  useEffect(() => {
    setShellConfig({
      contextNavLabel: "Mi perfil",
      compactNavLabel: "Mi perfil",
    });
    return () => setShellConfig({ contextNavLabel: undefined, compactNavLabel: undefined });
  }, [setShellConfig]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    const result = await updateMyProfileAction(fullName);
    setSavingProfile(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setFullName(result.data.fullName);
    setSavedName(result.data.fullName);
    router.refresh();
    notify.success("Perfil actualizado");
  }

  async function uploadAvatar(file: File | null) {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("avatar", file);
    setUploadingAvatar(true);
    const result = await uploadMyProfileAvatarAction(formData);
    setUploadingAvatar(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setAvatarUrl(result.data.avatarUrl);
    router.refresh();
    notify.success("Foto de perfil actualizada");
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setChangingPassword(true);
    const result = await changeMyPasswordAction(passwords);
    setChangingPassword(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setPasswords({ currentPassword: "", nextPassword: "", confirmation: "" });
    router.refresh();
    notify.success("Contraseña actualizada");
  }

  const shownName = fullName.trim() || session.email.split("@")[0];
  const visiblePermissions = session.permissions.includes("all")
    ? ["Acceso total a la aplicación"]
    : session.permissions.length
      ? session.permissions
      : ["Acceso según las tareas asignadas"];

  return (
    <div className="mx-auto w-full max-w-5xl p-3 sm:p-5 lg:p-6">
      <header className={`${cardClass} overflow-hidden bg-surface-card shadow-[0_8px_24px_rgba(0,0,0,0.22)]`}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-emerald-600 text-2xl font-black text-white shadow-[0_0_0_3px_rgba(52,211,153,0.12)]">
              {avatarUrl ? (
                // Signed Supabase URLs cannot be covered by a static remote image allow list.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                initials(shownName, session.email)
              )}
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-emerald-400 text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
              aria-label="Cambiar foto de perfil"
              title="Cambiar foto"
            >
              {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                void uploadAvatar(event.target.files?.[0] || null);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-300">Cuenta personal</p>
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-[#f8fafc] sm:text-3xl">{shownName}</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 truncate text-sm font-bold text-slate-400 sm:justify-start">
              <Mail className="h-4 w-4 shrink-0" />{session.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadingAvatar}
            className={`${secondaryButtonClass} h-10 shrink-0`}
          >
            <Camera className="h-4 w-4" />
            {uploadingAvatar ? "Subiendo..." : "Cambiar foto"}
          </button>
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
        <div className="grid gap-4">
          <section className={`${cardClass} bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)] sm:p-5`}>
            <div className="flex items-center gap-3 border-b border-black pb-3">
              <span className={`h-10 w-10 ${iconWellEmerald}`}><UserRound className="h-5 w-5" /></span>
              <div><h2 className="text-lg font-black text-[#f8fafc]">Datos personales</h2><p className="text-sm font-bold text-slate-400">Así aparece tu cuenta dentro de la aplicación.</p></div>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={(event) => void saveProfile(event)}>
              <label className="grid gap-1.5"><span className={labelMutedClass}>Nombre</span><input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} autoComplete="name" required /></label>
              <label className="grid gap-1.5"><span className={labelMutedClass}>Correo de acceso</span><span className={`${inputClass} flex items-center text-slate-400`}>{session.email}</span><span className="text-xs font-bold text-slate-500">El correo lo gestiona el administrador de la empresa.</span></label>
              <div className="flex justify-end"><button type="submit" className={primaryButtonClass} disabled={savingProfile || fullName.trim() === savedName.trim()}>{savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}{savingProfile ? "Guardando..." : "Guardar nombre"}</button></div>
            </form>
          </section>

          <section className={`${cardClass} bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)] sm:p-5`}>
            <div className="flex items-center gap-3 border-b border-black pb-3"><span className={`h-10 w-10 ${iconWellEmerald}`}><KeyRound className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[#f8fafc]">Contraseña</h2><p className="text-sm font-bold text-slate-400">Confirma tu contraseña actual antes de cambiarla.</p></div></div>
            <form className="mt-4 grid gap-3" onSubmit={(event) => void changePassword(event)}>
              <label className="grid gap-1.5"><span className={labelMutedClass}>Contraseña actual</span><input className={inputClass} type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" required /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5"><span className={labelMutedClass}>Nueva contraseña</span><input className={inputClass} type="password" value={passwords.nextPassword} onChange={(event) => setPasswords((current) => ({ ...current, nextPassword: event.target.value }))} autoComplete="new-password" minLength={8} required /></label><label className="grid gap-1.5"><span className={labelMutedClass}>Confirmar nueva contraseña</span><input className={inputClass} type="password" value={passwords.confirmation} onChange={(event) => setPasswords((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="new-password" minLength={8} required /></label></div>
              <div className="flex justify-end"><button type="submit" className={primaryButtonClass} disabled={changingPassword}>{changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{changingPassword ? "Actualizando..." : "Cambiar contraseña"}</button></div>
            </form>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className={`${cardClass} overflow-hidden bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]`}>
            <div className="flex items-center gap-3 border-b border-black bg-surface-card-header p-4"><span className={`h-10 w-10 ${iconWellEmerald}`}><BadgeCheck className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[#f8fafc]">Tu acceso</h2><p className="text-sm font-bold text-slate-400">Información asignada por la empresa.</p></div></div>
            <dl className="grid gap-3 p-4"><div className="rounded-lg border border-black bg-surface-inset p-3"><dt className={labelMutedClass}>Empresa</dt><dd className="mt-1 text-base font-black text-slate-100">{session.organizationName}</dd></div><div className="rounded-lg border border-black bg-surface-inset p-3"><dt className={labelMutedClass}>Rol</dt><dd className="mt-1 inline-flex items-center gap-1.5 text-base font-black text-emerald-200"><ShieldCheck className="h-4 w-4" />{session.roleName}</dd></div></dl>
          </section>
          <section className={`${cardClass} bg-surface-card p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)]`}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><h2 className="text-sm font-black text-[#f8fafc]">Permisos activos</h2></div><ul className="mt-3 grid gap-2">{visiblePermissions.map((permission) => <li key={permission} className="flex items-start gap-2 rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm font-bold text-slate-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />{permission}</li>)}</ul></section>
        </aside>
      </div>
    </div>
  );
}
