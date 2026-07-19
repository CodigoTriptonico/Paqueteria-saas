"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { signUpAction } from "@/app/actions/auth";
import { getCurrentSessionAction } from "@/app/actions/session";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { formatPersonNameInput } from "@/lib/person-name";

type FormMode = "login" | "signup" | "recover";

const fallbackStyles = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#29312d",
    padding: 16,
    color: "#f8fafc",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  card: { width: "100%", maxWidth: 448 },
  panel: {
    overflow: "hidden",
    borderRadius: 12,
    border: "1px solid #000",
    background: "#1e2623",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  },
  header: {
    borderBottom: "1px solid #000",
    background: "#252e2b",
    padding: "14px 16px",
  },
  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 900,
  },
  body: { padding: 16 },
  form: { display: "grid", gap: 16 },
  label: { display: "grid", gap: 8 },
  labelText: { color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 44,
    borderRadius: 8,
    border: "1px solid #000",
    background: "#2a322f",
    color: "#f8fafc",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 900,
  },
  primaryButton: {
    height: 40,
    border: 0,
    borderRadius: 8,
    background: "#34d399",
    color: "#020617",
    fontSize: 14,
    fontWeight: 900,
  },
  secondaryButton: {
    height: 40,
    borderRadius: 8,
    border: "1px solid #000",
    background: "#2a322f",
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: 900,
  },
  footer: { marginTop: 16, textAlign: "center", color: "#94a3b8", fontSize: 14 },
  link: { color: "#a7f3d0", textDecoration: "underline", fontWeight: 700 },
} satisfies Record<string, CSSProperties>;

export function LoginForm({ allowSignup = false }: { allowSignup?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(searchParams.get("error") || "");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const sessionResult = await getCurrentSessionAction();
        if (sessionResult.ok && sessionResult.data?.isPlatformAdmin) {
          setIsPlatformAdmin(true);
        }
      })();
    });
  }, []);

  function switchMode(next: FormMode) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (mode === "recover") {
      event.preventDefault();
      return;
    }

    if (mode === "login") {
      event.preventDefault();
      setLoading(true);
      setError("");

      const result = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          nextPath: searchParams.get("next"),
        }),
      });

      const data = (await result.json().catch(() => null)) as
        | { ok: true; redirectTo: string }
        | { ok: false; error: string }
        | null;

      setLoading(false);

      if (!data?.ok) {
        setError(data?.error || "No se pudo iniciar sesion");
        return;
      }

      router.replace(data.redirectTo);
      router.refresh();
      return;
    }

    if (mode === "signup") {
      event.preventDefault();

      if (!allowSignup) {
        setError("El registro publico no esta disponible. Contacta al administrador.");
        return;
      }

      setLoading(true);
      setError("");

      const nextParam = searchParams.get("next");
      const result = await signUpAction(email, password, organizationName, fullName, nextParam);

      setLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace(result.data.redirectTo);
      router.refresh();
    }
  }

  const title =
    mode === "login" ? "Iniciar sesion" : mode === "signup" ? "Crear cuenta" : "Recuperar contraseña";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-shell p-4" style={fallbackStyles.shell}>
      <div className="w-full max-w-md" style={fallbackStyles.card}>
        <section style={fallbackStyles.panel}>
          <div style={fallbackStyles.header}>
            <h3 style={fallbackStyles.title}>{title}</h3>
          </div>
          <div style={fallbackStyles.body}>
          {mode === "recover" ? (
            <div className="grid gap-4">
              <p className="rounded-lg border border-black bg-surface-inset px-3 py-3 text-sm font-bold text-slate-300">
                La recuperación por celular estará disponible pronto. El número se guarda al crear la
                paquetería, pero por ahora no enviamos códigos SMS.
              </p>
              <p className="text-sm font-bold text-slate-500">
                Si olvidaste tu contraseña, pide ayuda al administrador de tu empresa o al soporte de
                plataforma.
              </p>
              <button
                type="button"
                className={primaryButtonClass}
                style={fallbackStyles.primaryButton}
                onClick={() => switchMode("login")}
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <form className="grid gap-4" style={fallbackStyles.form} onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <>
                  <label className="grid gap-2" style={fallbackStyles.label}>
                    <span className="text-sm font-black uppercase text-slate-400" style={fallbackStyles.labelText}>
                      Empresa
                    </span>
                    <input
                      className={inputClass}
                      style={fallbackStyles.input}
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Nombre de la empresa"
                      required
                    />
                  </label>
                  <label className="grid gap-2" style={fallbackStyles.label}>
                    <span className="text-sm font-black uppercase text-slate-400" style={fallbackStyles.labelText}>
                      Nombre
                    </span>
                    <input
                      className={inputClass}
                      style={fallbackStyles.input}
                      value={fullName}
                      onChange={(event) =>
                        setFullName(formatPersonNameInput(event.target.value))
                      }
                      placeholder="Tu nombre"
                    />
                  </label>
                </>
              ) : null}

              <label className="grid gap-2" style={fallbackStyles.label}>
                <span className="text-sm font-black uppercase text-slate-400" style={fallbackStyles.labelText}>
                  Correo
                </span>
                <input
                  className={inputClass}
                  style={fallbackStyles.input}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <div className="grid gap-2" style={fallbackStyles.label}>
                <label
                  className="text-sm font-black uppercase text-slate-400"
                  htmlFor="login-password"
                  style={fallbackStyles.labelText}
                >
                  Contrasena
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    className={`${inputClass} pr-10`}
                    style={{ ...fallbackStyles.input, paddingRight: 40 }}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
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
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className={primaryButtonClass}
                style={fallbackStyles.primaryButton}
                disabled={loading}
              >
                {mode === "login" ? "Entrar" : "Registrar empresa"}
              </button>

              {mode === "login" ? (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  style={fallbackStyles.secondaryButton}
                  onClick={() => switchMode("recover")}
                >
                  Olvidé mi contraseña
                </button>
              ) : null}

              {allowSignup ? (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  style={fallbackStyles.secondaryButton}
                  onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
                </button>
              ) : null}
            </form>
          )}

          <p className="mt-4 text-center text-sm text-slate-400" style={fallbackStyles.footer}>
            <Link href="/" className="underline" style={fallbackStyles.link}>
              Volver al inicio
            </Link>
            {isPlatformAdmin ? (
              <>
                {" · "}
                <Link href="/platform" className="font-bold text-emerald-300 underline" style={fallbackStyles.link}>
                  Panel plataforma
                </Link>
              </>
            ) : null}
          </p>
          </div>
        </section>
      </div>
    </main>
  );
}
