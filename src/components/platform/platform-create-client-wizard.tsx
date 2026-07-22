"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  flowFieldLabelClass,
  flowFormFieldClass,
  flowIntroClass,
  flowLegendClass,
  flowSummaryDlClass,
  flowSummaryItemClass,
  flowWizardActionsClass,
  flowWizardStackClass,
} from "@/components/flow-form-styles";
import { FlowStepTitle } from "@/components/flow-step-title";
import { EmailDomainSuggestionsInput } from "@/components/email-domain-suggestions-input";
import { PhoneCountryInput } from "@/components/phone-country-input";
import { formatPersonNameInput } from "@/lib/person-name";
import { DEFAULT_MAX_WAREHOUSES } from "@/lib/organizations/settings";
import {
  isValidNationalPhone,
  maxNationalDigitsForDialCode,
  minNationalDigitsForDialCode,
  splitPhoneNumber,
} from "@/lib/phone/countries";
import { normalizePhoneDigits, normalizePhoneE164 } from "@/lib/phone/normalize";
import { createOrganizationAction } from "@/app/actions/platform";
import {
  createOrgSteps,
  type CreateOrgStep,
} from "@/components/platform/platform-create-org-flow-nav";
import { inputClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { generateTemporaryPassword, slugifyOrgName } from "@/lib/organizations/slug";
import {
  formatInitialTeamPlan,
  initialAdditionalUserLimit,
  initialTeamPlan,
  initialTeamUserLimit,
} from "@/lib/organizations/initial-team-plan";
import { passwordConfirmationMessage } from "@/lib/auth/password-confirmation";

const createOrgPageShellClass = "flex w-full min-h-0 flex-1 flex-col space-y-5 pb-8";
const createOrgPanelContentClass = "p-3 sm:p-4";
const createOrgStepBodyClass =
  "w-full rounded-lg border border-white/10 bg-[#34413b] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.24)] sm:p-5";
const configBoxClass =
  "rounded-lg border border-emerald-400/25 bg-[#202a26] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const dataColumnClass = "min-w-0 w-full space-y-5";
const compactFieldClass = `${flowFormFieldClass} max-w-none`;
const compactInputClass = `${inputClass} w-full border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20`;
const passwordFieldsClass = `max-w-[34rem] space-y-3 ${compactFieldClass}`;
const passwordGeneratorButtonClass = `${secondaryButtonClass} h-8 px-2.5 text-xs`;

type PlatformCreateClientWizardProps = {
  onCancel: () => void;
  onCreated: (organizationId: string, summary: string) => void;
  onError: (message: string) => void;
};

const emptyForm = {
  orgName: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPhones: [""],
  adminPassword: "",
  adminPasswordConfirmation: "",
};

const addContactRowButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-400 text-slate-950 shadow-[0_8px_18px_rgba(16,185,129,0.18)] transition hover:bg-emerald-300";
const removeContactRowButtonClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-rose-400/20 bg-rose-950/45 text-rose-100 transition hover:bg-rose-900/60 disabled:cursor-not-allowed disabled:opacity-35";
const shareMenuItemClass =
  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-black text-[#f8fafc] transition hover:bg-white/5";

function normalizeContactList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function formatContactList(values: string[]) {
  return normalizeContactList(values).join(" · ");
}

function getAdminFullName(form: typeof emptyForm) {
  return [form.adminFirstName.trim(), form.adminLastName.trim()].filter(Boolean).join(" ");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getDataStepValidationMessage(form: typeof emptyForm): string | null {
  if (form.orgName.trim().length < 2) {
    return "Escribe el nombre comercial (mínimo 2 caracteres).";
  }
  if (form.adminFirstName.trim().length < 2) {
    return "Escribe el nombre del dueño.";
  }
  if (form.adminLastName.trim().length < 2) {
    return "Escribe el apellido del dueño.";
  }
  if (!isValidEmail(form.adminEmail)) {
    return "Ingresa un correo válido para el dueño.";
  }

  const phones = normalizeContactList(form.adminPhones);
  if (!phones.length || !isValidNationalPhone(phones[0])) {
    const { dialCode } = splitPhoneNumber(phones[0] || "");
    const min = minNationalDigitsForDialCode(dialCode);
    const max = maxNationalDigitsForDialCode(dialCode);
    const range = min === max ? `${min}` : `${min} a ${max}`;
    return `Ingresa un celular válido (${range} dígitos sin el código de país).`;
  }
  for (let index = 1; index < phones.length; index += 1) {
    if (!isValidNationalPhone(phones[index])) {
      return `El celular adicional ${index + 1} no es válido.`;
    }
  }
  const phoneDigits = phones.map((phone) => normalizePhoneDigits(phone));
  if (new Set(phoneDigits).size !== phoneDigits.length) {
    return "No repitas números de celular del dueño.";
  }
  if (form.adminPassword.trim().length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  return passwordConfirmationMessage(form.adminPassword, form.adminPasswordConfirmation);
}

function resolveCompletedStep(created: boolean): CreateOrgStep {
  return created ? "done" : "data";
}

function clampPlanLimit(
  value: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function PlatformCreateClientWizard({
  onCancel,
  onCreated,
  onError,
}: PlatformCreateClientWizardProps) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    adminPassword: generateTemporaryPassword(),
  }));
  const [orgSettings, setOrgSettings] = useState({
    maxUsers: initialAdditionalUserLimit,
    maxWarehouses: DEFAULT_MAX_WAREHOUSES,
    agenciesEnabled: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [stepHint, setStepHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState<CreateOrgStep>("data");
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    orgName: string;
    email: string;
    phones: string[];
    password: string;
    maxUsers: number;
    maxWarehouses: number;
    agenciesEnabled: boolean;
  } | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const suggestedSlug = useMemo(() => slugifyOrgName(form.orgName), [form.orgName]);
  const created = Boolean(createdOrgId && createdCredentials);

  const completedStep = useMemo(() => resolveCompletedStep(created), [created]);
  const completedStepIndex = createOrgSteps.findIndex((step) => step.id === completedStep);
  const maxUnlockedStepIndex = created ? createOrgSteps.length - 1 : completedStepIndex;

  const canOpenStep = useCallback(
    (step: CreateOrgStep) =>
      createOrgSteps.findIndex((currentStep) => currentStep.id === step) <= maxUnlockedStepIndex,
    [maxUnlockedStepIndex],
  );

  useEffect(() => {
    if (!shareMenuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!shareMenuRef.current?.contains(event.target as Node)) {
        setShareMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShareMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [shareMenuOpen]);

  const dataRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const scrollToStep = useCallback((step: CreateOrgStep) => {
    const target = step === "data" ? dataRef.current : doneRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openStep = useCallback(
    (step: CreateOrgStep) => {
      if (!canOpenStep(step)) {
        return;
      }

      setActiveStep(step);
      scrollToStep(step);
    },
    [canOpenStep, scrollToStep],
  );

  function generatePassword() {
    const password = generateTemporaryPassword();
    setForm((current) => ({
      ...current,
      adminPassword: password,
      adminPasswordConfirmation: password,
    }));
    setShowPassword(true);
  }

  function addAdminPhone() {
    setForm((current) => ({ ...current, adminPhones: [...current.adminPhones, ""] }));
    setStepHint(null);
  }

  function updateAdminPhone(index: number, value: string) {
    setForm((current) => ({
      ...current,
      adminPhones: current.adminPhones.map((phone, phoneIndex) =>
        phoneIndex === index ? value : phone,
      ),
    }));
    setStepHint(null);
  }

  function removeAdminPhone(index: number) {
    setForm((current) => ({
      ...current,
      adminPhones:
        current.adminPhones.length <= 1
          ? [""]
          : current.adminPhones.filter((_, phoneIndex) => phoneIndex !== index),
    }));
    setStepHint(null);
  }

  function handleSubmit() {
    onError("");
    const validationMessage = getDataStepValidationMessage(form);

    if (validationMessage) {
      setStepHint(validationMessage);
      return;
    }

    setStepHint(null);
    void handleCreate();
  }

  async function handleCreate() {
    onError("");
    setSubmitting(true);

    const password = form.adminPassword.trim();
    const email = form.adminEmail.trim().toLowerCase();
    const phones = normalizeContactList(form.adminPhones);

    const result = await createOrganizationAction({
      name: form.orgName.trim(),
      slug: suggestedSlug || undefined,
      adminEmail: email,
      adminPassword: password,
      adminFullName: getAdminFullName(form) || undefined,
      adminPhones: phones,
      settings: orgSettings,
    });

    setSubmitting(false);

    if (!result.ok) {
      onError(result.error);
      return;
    }

    const credentials = {
      orgName: form.orgName.trim(),
      email,
      phones,
      password,
      maxUsers: orgSettings.maxUsers,
      maxWarehouses: orgSettings.maxWarehouses,
      agenciesEnabled: orgSettings.agenciesEnabled,
    };

    setCreatedOrgId(result.data.organizationId);
    setCreatedCredentials(credentials);
    setActiveStep("done");
    queueMicrotask(() => scrollToStep("done"));
  }

  function buildCredentialsText() {
    if (!createdCredentials) {
      return "";
    }

    return [
      `Paquetería: ${createdCredentials.orgName}`,
      `Correo: ${createdCredentials.email}`,
      `Celular${createdCredentials.phones.length > 1 ? "es" : ""}: ${formatContactList(createdCredentials.phones)}`,
      `Contraseña: ${createdCredentials.password}`,
      `URL: ${typeof window !== "undefined" ? window.location.origin : ""}/login`,
    ].join("\n");
  }

  async function copyCredentials() {
    const text = buildCredentialsText();
    if (!text) {
      return;
    }

    await navigator.clipboard.writeText(text);
    setShareMenuOpen(false);
    onError("");
  }

  function sendCredentialsBySms() {
    if (!createdCredentials) {
      return;
    }

    const e164 = normalizePhoneE164(createdCredentials.phones[0] ?? "");
    if (!e164) {
      onError("No hay un celular válido para enviar el mensaje.");
      return;
    }

    const body = encodeURIComponent(buildCredentialsText());
    window.location.href = `sms:${e164}?body=${body}`;
    setShareMenuOpen(false);
    onError("");
  }

  function finishWizard() {
    if (!createdOrgId || !createdCredentials) {
      onCancel();
      return;
    }

    onCreated(
      createdOrgId,
      `Paquetería "${createdCredentials.orgName}" creada. Comparte las credenciales con el dueño.`,
    );
  }

  const continueButtonClass = `${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-40`;
  const showDoneSection = created;
  const dataCollapsed = activeStep !== "data";
  const passwordConfirmationError = passwordConfirmationMessage(
    form.adminPassword,
    form.adminPasswordConfirmation,
  );
  const showPasswordConfirmationError = Boolean(
    form.adminPasswordConfirmation && passwordConfirmationError,
  );

  function renderCollapsedDataHint() {
    return (
      <p className="text-sm font-bold text-slate-300">
        <span className="text-[#f8fafc]">{form.orgName.trim()}</span>
        {" · "}
        {getAdminFullName(form)}
        {" · "}
        <span className="text-slate-400">{form.adminEmail.trim()}</span>
      </p>
    );
  }

  return (
    <div className={createOrgPageShellClass}>
      <div ref={dataRef} className="motion-enter-top scroll-mt-24">
        <Panel
          clipContent={false}
          contentClassName={createOrgPanelContentClass}
          title={
            <FlowStepTitle
              stepNumber={1}
              done={dataCollapsed}
              label="Datos de la paquetería"
            />
          }
          action={
            dataCollapsed && !created ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => openStep("data")}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            ) : null
          }
        >
          {dataCollapsed ? renderCollapsedDataHint() : (
            <form
              className={createOrgStepBodyClass}
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
              <div className={dataColumnClass}>
              <p className={`${flowIntroClass} rounded-lg border border-white/10 bg-[#26322e] px-4 py-3 text-left`}>
                Completa los datos y pulsa Crear paquetería para darla de alta de inmediato.
              </p>
              <fieldset className="space-y-3 rounded-lg border border-white/10 bg-[#2b3833] p-4">
                <legend className={`${flowLegendClass} rounded-md bg-[#34413b] px-2 py-1`}>
                  <Building2 className="h-4 w-4" aria-hidden />
                  Paquetería
                </legend>
                <label className={`grid gap-1 ${compactFieldClass}`}>
                  <span className={flowFieldLabelClass}>Nombre comercial</span>
                  <input
                    className={compactInputClass}
                    value={form.orgName}
                    onChange={(e) => {
                      setForm((c) => ({ ...c, orgName: e.target.value }));
                      setStepHint(null);
                    }}
                    placeholder="Ej. Envíos Rápidos Miami"
                    autoComplete="off"
                    autoFocus
                  />
                </label>
              </fieldset>
              <fieldset className="space-y-4 rounded-lg border border-white/10 bg-[#2b3833] p-4">
                <legend className={`mb-1 rounded-md bg-[#34413b] px-2 py-1 ${flowLegendClass}`}>
                  <User className="h-4 w-4" aria-hidden />
                  Dueño y acceso
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={`grid gap-1 ${compactFieldClass}`}>
                    <span className={flowFieldLabelClass}>Nombre</span>
                    <input
                      className={compactInputClass}
                      value={form.adminFirstName}
                      onChange={(e) => {
                        setForm((c) => ({
                          ...c,
                          adminFirstName: formatPersonNameInput(e.target.value),
                        }));
                        setStepHint(null);
                      }}
                      placeholder="Nombre"
                      autoComplete="off"
                    />
                  </label>
                  <label className={`grid gap-1 ${compactFieldClass}`}>
                    <span className={flowFieldLabelClass}>Apellido</span>
                    <input
                      className={compactInputClass}
                      value={form.adminLastName}
                      onChange={(e) => {
                        setForm((c) => ({
                          ...c,
                          adminLastName: formatPersonNameInput(e.target.value),
                        }));
                        setStepHint(null);
                      }}
                      placeholder="Apellido"
                      autoComplete="off"
                    />
                  </label>
                  <label className={`grid gap-1 sm:col-span-2 ${compactFieldClass}`}>
                    <span className={flowFieldLabelClass}>Correo de acceso</span>
                    <EmailDomainSuggestionsInput
                      className="relative"
                      inputClassName={`${compactInputClass} pl-10`}
                      name="client_admin_email"
                      value={form.adminEmail}
                      onChange={(adminEmail) => {
                        setForm((c) => ({ ...c, adminEmail }));
                        setStepHint(null);
                      }}
                      placeholder="dueño@paqueteria.com"
                      icon={<Mail className="h-4 w-4" aria-hidden />}
                    />
                  </label>
                </div>
                <div className={`space-y-2 ${compactFieldClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={flowFieldLabelClass}>Celular</span>
                    <button
                      type="button"
                      className={addContactRowButtonClass}
                      onClick={addAdminPhone}
                      title="Agregar celular"
                      aria-label="Agregar celular"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {form.adminPhones.map((phone, index) => (
                    <div key={`admin-phone-${index}`} className="flex flex-wrap items-start gap-2 rounded-lg border border-white/10 bg-[#26322e] p-2">
                      <PhoneCountryInput
                        className="w-fit max-w-full min-w-0 flex-1"
                        name={`client_admin_phone_${index}`}
                        value={phone}
                        onChange={(value) => updateAdminPhone(index, value)}
                      />
                      <button
                        type="button"
                        className={removeContactRowButtonClass}
                        title="Quitar celular"
                        aria-label="Quitar celular"
                        disabled={form.adminPhones.length === 1}
                        onClick={() => removeAdminPhone(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <span className="text-xs font-bold text-slate-400">
                    Cualquiera de estos celulares sirve para recuperar contraseña por SMS.
                  </span>
                </div>
                <div className={passwordFieldsClass}>
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="text-xs font-bold text-slate-400">Acceso inicial</span>
                    <button
                      type="button"
                      className={passwordGeneratorButtonClass}
                      onClick={generatePassword}
                      title="Generar una contraseña segura"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Generar segura
                    </button>
                  </div>
                  <label className="grid gap-1">
                    <span className={flowFieldLabelClass}>Contraseña inicial</span>
                    <div className="relative min-w-0">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        className={`${compactInputClass} pl-10 pr-10`}
                        type={showPassword ? "text" : "password"}
                        name="client_admin_password"
                        aria-label="Contraseña inicial"
                        value={form.adminPassword}
                        onChange={(e) => {
                          setForm((c) => ({ ...c, adminPassword: e.target.value }));
                          setStepHint(null);
                        }}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <label className="grid gap-1">
                    <span className={flowFieldLabelClass}>Confirmar contraseña</span>
                    <div className="relative min-w-0">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        className={`${compactInputClass} pl-10 ${
                          showPasswordConfirmationError
                            ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/20"
                            : ""
                        }`}
                        type={showPassword ? "text" : "password"}
                        name="client_admin_password_confirmation"
                        value={form.adminPasswordConfirmation}
                        onChange={(e) => {
                          setForm((c) => ({ ...c, adminPasswordConfirmation: e.target.value }));
                          setStepHint(null);
                        }}
                        placeholder="Escríbela otra vez"
                        autoComplete="new-password"
                      />
                    </div>
                    {showPasswordConfirmationError ? (
                      <span className="text-xs font-bold text-rose-200">{passwordConfirmationError}</span>
                    ) : null}
                  </label>
                </div>
              </fieldset>

              {stepHint ? (
                <p className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-center text-sm font-bold text-amber-100">
                  {stepHint}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <button
                  type="submit"
                  className={continueButtonClass}
                  disabled={submitting || showPasswordConfirmationError}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Crear paquetería
                </button>
                <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={submitting}>
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              </div>
              </div>
              <aside className={configBoxClass}>
                <p className="text-xs font-black uppercase text-emerald-300">Plan inicial</p>
                <div className="mt-3 space-y-4">
                  <section className="rounded-md border border-white/10 bg-[#26322e] p-3">
                    <p className={flowFieldLabelClass}>Equipo incluido</p>
                    <div className="mt-2 space-y-2">
                      {initialTeamPlan.map((role) => (
                        <div key={role.label} className="flex items-center justify-between gap-2 text-sm font-bold">
                          <span className="text-slate-200">{role.label}</span>
                          <span className="shrink-0 text-emerald-300">{role.detail}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="text-sm font-black text-[#f8fafc]">{initialTeamUserLimit} usuarios en total</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-400">
                        {initialAdditionalUserLimit} espacios además del dueño.
                      </p>
                    </div>
                  </section>
                  <label className="grid gap-1">
                    <span className={flowFieldLabelClass}>Bodegas máximas</span>
                    <input
                      className={compactInputClass}
                      type="number"
                      min={1}
                      max={100}
                      value={orgSettings.maxWarehouses}
                      onChange={(event) =>
                        setOrgSettings((current) => ({
                          ...current,
                          maxWarehouses: clampPlanLimit(
                            event.target.value,
                            1,
                            100,
                            current.maxWarehouses,
                          ),
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={orgSettings.agenciesEnabled}
                    onClick={() =>
                      setOrgSettings((current) => ({
                        ...current,
                        agenciesEnabled: !current.agenciesEnabled,
                      }))
                    }
                    className={`flex min-h-20 items-center justify-between gap-3 rounded-lg border px-3 text-left ${
                      orgSettings.agenciesEnabled
                        ? "border-emerald-500/60 bg-emerald-950/35"
                        : "border-white/10 bg-[#26322e]"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-black text-slate-100">Módulo Agencias</span>
                      <span className="mt-1 block text-xs font-bold text-slate-400">
                        Desactivado por defecto. Solo Boxario puede incluirlo en el plan.
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-7 w-12 shrink-0 rounded-full border border-black p-1 ${
                        orgSettings.agenciesEnabled ? "justify-end bg-emerald-400" : "justify-start bg-surface-card"
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full bg-slate-950" />
                    </span>
                  </button>
                </div>
              </aside>
              </div>
            </form>
          )}
        </Panel>
      </div>

      {showDoneSection && createdCredentials ? (
        <div ref={doneRef} className="motion-enter-top scroll-mt-24">
          <Panel
            clipContent={false}
            contentClassName={createOrgPanelContentClass}
            title={<FlowStepTitle stepNumber={2} done label="Listo — credenciales" />}
          >
            <div className={createOrgStepBodyClass}>
              <div className={flowWizardStackClass}>
                <p
                  className={`${flowIntroClass} rounded-lg border border-emerald-400/20 bg-emerald-950/25 px-4 py-3 text-left text-emerald-100`}
                >
                  Comparte estas credenciales con el dueño para que entre a operar su paquetería.
                </p>
                <dl className={flowSummaryDlClass}>
                  <div className={`${flowSummaryItemClass} sm:col-span-2`}>
                    <dt className="text-[11px] font-black uppercase text-slate-500">Empresa</dt>
                    <dd className="mt-0.5 font-black text-[#f8fafc]">{createdCredentials.orgName}</dd>
                  </div>
                  <div className={`${flowSummaryItemClass} sm:col-span-2`}>
                    <dt className="text-[11px] font-black uppercase text-slate-500">Correo</dt>
                    <dd className="mt-0.5 break-all font-black text-[#f8fafc]">{createdCredentials.email}</dd>
                  </div>
                  <div className={`${flowSummaryItemClass} sm:col-span-2`}>
                    <dt className="text-[11px] font-black uppercase text-slate-500">Plan</dt>
                    <dd className="mt-0.5 font-black text-[#f8fafc]">
                      {createdCredentials.maxUsers === initialAdditionalUserLimit
                        ? formatInitialTeamPlan()
                        : `${createdCredentials.maxUsers} usuario${createdCredentials.maxUsers === 1 ? "" : "s"} adicional${createdCredentials.maxUsers === 1 ? "" : "es"}`}{" "}
                      · {createdCredentials.maxWarehouses}{" "}
                      {createdCredentials.maxWarehouses === 1
                        ? "bodega máxima"
                        : "bodegas máximas"}{" "}
                      · Agencias {createdCredentials.agenciesEnabled ? "incluidas" : "no incluidas"}
                    </dd>
                  </div>
                  <div className={flowSummaryItemClass}>
                    <dt className="text-[11px] font-black uppercase text-slate-500">Celular</dt>
                    <dd className="mt-0.5 font-black text-[#f8fafc]">
                      {formatContactList(createdCredentials.phones)}
                    </dd>
                  </div>
                  <div className={flowSummaryItemClass}>
                    <dt className="text-[11px] font-black uppercase text-slate-500">Contraseña</dt>
                    <dd className="mt-0.5 font-mono text-sm font-black text-slate-200">
                      {createdCredentials.password}
                    </dd>
                  </div>
                </dl>
                <div className={flowWizardActionsClass}>
                  <div ref={shareMenuRef} className="relative">
                    <button
                      type="button"
                      className={`${primaryButtonClass} gap-1 pr-2`}
                      onClick={() => setShareMenuOpen((value) => !value)}
                      aria-expanded={shareMenuOpen}
                      aria-haspopup="menu"
                    >
                      <Copy className="h-4 w-4" />
                      Compartir credenciales
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${shareMenuOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {shareMenuOpen ? (
                      <div
                        role="menu"
                        className="absolute left-0 top-full z-[200] mt-1 min-w-[15rem] overflow-hidden rounded-lg border border-white/10 bg-[#2b3833] py-1 shadow-[0_14px_34px_rgba(0,0,0,0.35)]"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className={shareMenuItemClass}
                          onClick={() => void copyCredentials()}
                        >
                          <Copy className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                          Copiar
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={shareMenuItemClass}
                          onClick={sendCredentialsBySms}
                        >
                          <MessageSquare className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                          Enviar por mensaje de texto
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className={secondaryButtonClass} onClick={finishWizard}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
