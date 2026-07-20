"use client";

import { Building2, Camera, Loader2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOrganizationProfileAction,
  updateOrganizationProfileAction,
  uploadOrganizationLogoAction,
  type OrganizationProfile,
} from "@/app/actions/organization";
import { PageLoading } from "@/components/page-loading";
import {
  settingsFieldLabelClass,
  settingsIconBoxClass,
  settingsSectionClass,
  settingsSectionHeaderClass,
  settingsSectionTitleClass,
} from "@/components/config/settings-panel-styles";
import { inputClass, primaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { organizationBrandInitials } from "@/lib/organizations/branding";

const compactInputClass = `${inputClass} h-10`;
const helperTextClass = "text-[11px] font-bold leading-snug text-slate-500";

export function CompanySettingsPanel() {
  const router = useRouter();
  const notify = useNotify();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    shortName: "",
    phone: "",
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
    setLogoUrl(profile.logoUrl);
    setForm({
      name: profile.name,
      shortName: profile.shortName,
      phone: profile.phone,
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

  async function uploadLogo(file: File | null) {
    if (!file || !canEdit) {
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.set("logo", file);
    const result = await uploadOrganizationLogoAction(formData);
    setUploadingLogo(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setLogoUrl(result.data.logoUrl);
    notify.success("Logo actualizado.");
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

  const brandPreview = form.shortName.trim() || form.name.trim() || "Empresa";
  const menuTitle = form.shortName.trim() || form.name.trim() || "Tu empresa";
  const invoiceName = form.name.trim() || "Nombre comercial";

  return (
    <form className="space-y-4" onSubmit={handleSave}>
      {!canEdit ? (
        <p className="rounded-xl border border-black bg-surface-inset/40 px-4 py-3 text-sm font-bold text-slate-400">
          Solo lectura. Pide a un administrador permiso de configuracion para editar.
        </p>
      ) : null}

      <section className={settingsSectionClass}>
        <div className={settingsSectionHeaderClass}>
          <p className={settingsSectionTitleClass}>
            <span className={settingsIconBoxClass}>
              <Building2 className="h-4 w-4" />
            </span>
            Identidad de la empresa
          </p>
          {canEdit ? (
            <button
              type="submit"
              className={`${primaryButtonClass} h-9 gap-2 px-4`}
              disabled={saving || uploadingLogo || !form.name.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          ) : null}
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
          <div className="grid gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-black bg-emerald-600 text-2xl font-black text-white shadow-[0_0_0_3px_rgba(52,211,153,0.12)]">
                    {logoUrl ? (
                      // Signed Supabase URLs cannot be covered by a static remote image allow list.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt="Logo de la empresa"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      organizationBrandInitials(brandPreview)
                    )}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo || saving}
                      className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-emerald-400 text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                      aria-label="Subir logo de la empresa"
                      title="Subir logo"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo || saving}
                    className="text-[11px] font-black uppercase text-emerald-300 transition hover:text-emerald-200 disabled:opacity-50"
                  >
                    {uploadingLogo ? "Subiendo..." : "Cambiar logo"}
                  </button>
                ) : null}
                <p className="max-w-[9rem] text-center text-[10px] font-bold leading-snug text-slate-500 sm:text-left">
                  JPG, PNG o WebP. Maximo 4 MB.
                </p>
              </div>

              <div className="min-w-0 flex-1 grid gap-3">
                <label className={settingsFieldLabelClass}>
                  Nombre comercial
                  <input
                    className={compactInputClass}
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Nombre en facturas y documentos"
                    disabled={!canEdit || saving}
                    required
                  />
                  <span className={helperTextClass}>Nombre legal o comercial completo.</span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={settingsFieldLabelClass}>
                    Acronimo
                    <input
                      className={compactInputClass}
                      value={form.shortName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, shortName: event.target.value }))
                      }
                      placeholder="Ej: ACME"
                      disabled={!canEdit || saving}
                      maxLength={24}
                    />
                    <span className={helperTextClass}>Texto corto del menu lateral.</span>
                  </label>

                  <label className={settingsFieldLabelClass}>
                    Telefono
                    <input
                      className={compactInputClass}
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="(305) 000-0000"
                      disabled={!canEdit || saving}
                      inputMode="tel"
                    />
                    <span className={helperTextClass}>Contacto principal de la empresa.</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-black bg-surface-inset/40 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Vista previa
            </p>
            <div className="mt-3 rounded-lg border border-black bg-surface-card p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black bg-emerald-600 text-xs font-black text-white">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    organizationBrandInitials(brandPreview)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#f8fafc]">{menuTitle}</p>
                  <p className="truncate text-[10px] font-bold text-slate-500">Menu lateral</p>
                </div>
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-black bg-surface-card px-2.5 py-2">
              <p className="text-[10px] font-black uppercase text-slate-500">Factura</p>
              <p className="mt-1 truncate text-xs font-black text-[#f8fafc]">{invoiceName}</p>
              {form.phone.trim() ? (
                <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400">{form.phone}</p>
              ) : (
                <p className="mt-0.5 text-[11px] font-bold text-slate-600">Sin telefono</p>
              )}
            </div>
          </aside>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            void uploadLogo(event.target.files?.[0] || null);
            event.currentTarget.value = "";
          }}
        />
      </section>
    </form>
  );
}
