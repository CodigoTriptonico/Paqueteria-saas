"use client";

import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { inviteOrgUserAction, listOrgUsersAction, updateOrgUserAction, type OrgUserRow } from "@/app/actions/users";
import { agencyDemoSellerLimit } from "@/lib/agency-demo-team";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { inputClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { uppercasePersonNameInput } from "@/lib/person-name";

const fieldClass = `${inputClass} w-full`;

export function AgencyTeamPanel() {
  const notify = useNotify();
  const [users, setUsers] = useState<OrgUserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ email: "", fullName: "", password: generateTemporaryPassword() });
  const sellers = useMemo(() => users.filter((user) => user.is_active && user.role.slug === "vendedor_agencia"), [users]);
  const availableSeats = Math.max(0, agencyDemoSellerLimit - sellers.length);

  const reload = useCallback(async () => {
    const result = await listOrgUsersAction();
    if (result.ok) setUsers(result.data);
    else notify.error(result.error);
    setLoaded(true);
  }, [notify]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await inviteOrgUserAction({
        email: form.email,
        fullName: form.fullName,
        password: form.password,
        roleSlug: "vendedor_agencia",
        warehouseIds: [],
      });
      if (!result.ok) return notify.error(result.error);
      setForm({ email: "", fullName: "", password: generateTemporaryPassword() });
      notify.success("Vendedor agregado a la agencia.");
      await reload();
    });
  }

  function deactivateSeller(userId: string) {
    startTransition(async () => {
      const result = await updateOrgUserAction({ userId, isActive: false });
      if (!result.ok) return notify.error(result.error);
      notify.success("Vendedor desactivado. Ese cupo quedó disponible.");
      await reload();
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-3 sm:p-5">
      <Panel title="Equipo de la agencia" action={<span className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-200">{sellers.length} / {agencyDemoSellerLimit} vendedores</span>}>
        <p className="text-sm font-bold text-slate-300">La agencia tiene un administrador responsable y hasta dos vendedores. No usa conductores, logística ni otros roles.</p>
        <form className="mt-4 grid gap-2 border-t border-black pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={submit}>
          <input className={fieldClass} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: uppercasePersonNameInput(event.target.value) }))} placeholder="Nombre del vendedor" required disabled={!availableSeats || pending} />
          <input className={fieldClass} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="correo@agencia.com" required disabled={!availableSeats || pending} />
          <div className="flex min-w-0 gap-2"><input className={`${fieldClass} min-w-0 font-mono text-sm`} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Contraseña temporal" required disabled={!availableSeats || pending} /><button type="button" className={`${secondaryButtonClass} h-10 px-2 text-xs`} onClick={() => setForm((current) => ({ ...current, password: generateTemporaryPassword() }))} disabled={!availableSeats || pending}>Nueva</button></div>
          <button type="submit" className={primaryButtonClass} disabled={!availableSeats || pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Agregar</button>
        </form>
        {!availableSeats ? <p className="mt-3 text-xs font-bold text-amber-200">Ya usaste los dos cupos de vendedor de esta demo.</p> : null}
      </Panel>
      <Panel title="Usuarios activos" hideHeader contentClassName="p-3">
        {!loaded ? <p className="text-sm font-bold text-slate-400">Cargando equipo...</p> : <div className="grid gap-2">{users.filter((user) => user.is_active).map((user) => <article key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-black bg-surface-list-row p-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-200"><Users className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-black text-slate-100">{user.full_name || user.email}</p><p className="text-xs font-bold text-slate-400">{user.email} · {user.role.name}</p></div>{user.role.slug === "vendedor_agencia" ? <button type="button" className={`${secondaryButtonClass} h-8 px-2.5 text-xs text-rose-100`} onClick={() => deactivateSeller(user.id)} disabled={pending}><UserMinus className="h-3.5 w-3.5" /> Desactivar</button> : null}</article>)}</div>}
      </Panel>
    </div>
  );
}
