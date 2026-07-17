"use client";

import { Building2, KeyRound, Loader2, RefreshCw, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCaptorAgencyAction } from "@/app/actions/agencies";
import { EmailDomainSuggestionsInput } from "@/components/email-domain-suggestions-input";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { passwordConfirmationMessage } from "@/lib/auth/password-confirmation";
import { generateTemporaryPassword } from "@/lib/organizations/slug";
import { useNotify } from "@/hooks/use-notify";

const fieldClass = `${inputClass} w-full`;

export function AgencyCaptorCreatePanel() {
  const router = useRouter();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => {
    const password = generateTemporaryPassword();
    return { name: "", administratorFullName: "", administratorEmail: "", password, confirmation: password };
  });
  const confirmationError = passwordConfirmationMessage(form.password, form.confirmation);

  function generatePassword() {
    const password = generateTemporaryPassword();
    setForm((current) => ({ ...current, password, confirmation: password }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmationError) {
      notify.error(confirmationError);
      return;
    }

    startTransition(async () => {
      const result = await createCaptorAgencyAction({
        name: form.name,
        administratorFullName: form.administratorFullName,
        administratorEmail: form.administratorEmail,
        administratorPassword: form.password,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      notify.success("Agencia creada con su administrador y dos cupos de vendedor.");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className={primaryButtonClass} onClick={() => setOpen(true)}>
        <Building2 className="h-4 w-4" />
        Captar agencia
      </button>
    );
  }

  return (
    <form className="grid gap-3 rounded-lg border border-emerald-400/25 bg-[#202a26] p-3" onSubmit={submit}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-100">Nueva agencia</p>
          <p className="text-xs font-bold text-slate-400">Incluye 1 administrador y hasta 2 vendedores.</p>
        </div>
        <button type="button" className={`${secondaryButtonClass} h-8 px-2.5 text-xs`} onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-black text-slate-300">
          Nombre de la agencia
          <input className={fieldClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-300">
          Responsable
          <input className={fieldClass} value={form.administratorFullName} onChange={(event) => setForm((current) => ({ ...current, administratorFullName: event.target.value }))} required />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-300 sm:col-span-2">
          Correo del administrador
          <EmailDomainSuggestionsInput className="relative" inputClassName={fieldClass} name="agency_administrator_email" value={form.administratorEmail} onChange={(administratorEmail) => setForm((current) => ({ ...current, administratorEmail }))} placeholder="responsable@agencia.com" />
        </label>
      </div>
      <div className="grid max-w-[34rem] gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <span className="text-xs font-bold text-slate-400">Acceso del administrador</span>
          <button type="button" className={`${secondaryButtonClass} h-8 px-2.5 text-xs`} onClick={generatePassword}>
            <RefreshCw className="h-3.5 w-3.5" />
            Generar segura
          </button>
        </div>
        <label className="grid gap-1 text-xs font-black text-slate-300">
          Contraseña inicial
          <span className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className={`${fieldClass} pl-10`} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" required /></span>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-300">
          Confirmar contraseña
          <span className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className={`${fieldClass} pl-10`} type="password" value={form.confirmation} onChange={(event) => setForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="new-password" required /></span>
          {confirmationError ? <span className="text-xs font-bold text-rose-200">{confirmationError}</span> : null}
        </label>
      </div>
      <button type="submit" className={`${primaryButtonClass} w-fit`} disabled={pending || Boolean(confirmationError)}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
        Crear agencia
      </button>
    </form>
  );
}
