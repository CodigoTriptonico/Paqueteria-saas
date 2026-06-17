"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOrganizationProfileAction,
  updateOrganizationProfileAction,
  type OrganizationProfile,
} from "@/app/actions/organization";
import { PageLoading } from "@/components/page-loading";
import { inputClass, primaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";

const fieldLabelClass = "text-lg font-black text-[#f8fafc]";

export function CompanySettingsPanel() {
  const router = useRouter();
  const notify = useNotify();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    currency: "",
  });

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getOrganizationProfileAction();
      setLoaded(true);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      applyProfile(result.data);
    });
  }, []);

  function applyProfile(profile: OrganizationProfile) {
    setCanEdit(profile.canEdit);
    setForm({
      name: profile.name,
      phone: profile.phone,
      address: profile.address,
      currency: profile.currency,
    });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    setSaving(true);
    const result = await updateOrganizationProfileAction(form);
    setSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    applyProfile(result.data);
    notify.success("Datos de empresa guardados.");
    router.refresh();
  }

  if (!loaded) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-200">
        {error}
      </p>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSave}>
      {!canEdit ? (
        <p className="rounded-xl border border-black bg-surface-inset px-4 py-3 text-sm font-bold text-slate-400">
          Solo lectura. Pide a un administrador permiso de configuración para editar.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className={fieldLabelClass}>Nombre de la empresa</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Nombre comercial"
            disabled={!canEdit || saving}
            required
          />
        </label>

        <label className="grid gap-2">
          <span className={fieldLabelClass}>Teléfono</span>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="Ej: (305) 000-0000"
            disabled={!canEdit || saving}
          />
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className={fieldLabelClass}>Dirección</span>
          <input
            className={inputClass}
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({ ...current, address: event.target.value }))
            }
            placeholder="Calle, ciudad, estado"
            disabled={!canEdit || saving}
          />
        </label>

        <label className="grid gap-2">
          <span className={fieldLabelClass}>Moneda</span>
          <input
            className={inputClass}
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({ ...current, currency: event.target.value }))
            }
            placeholder="Ej: USD"
            disabled={!canEdit || saving}
          />
        </label>
      </div>

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="submit"
            className={`${primaryButtonClass} gap-2`}
            disabled={saving || !form.name.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      ) : null}
    </form>
  );
}
