"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signUpAction } from "@/app/actions/auth";
import { getCurrentSessionAction } from "@/app/actions/session";
import { inputClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

type FormMode = "login" | "signup" | "recover";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(searchParams.get("error") || "");
  const [loading, setLoading] = useState(false);
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

    event.preventDefault();
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

  const title =
    mode === "login" ? "Iniciar sesion" : mode === "signup" ? "Crear cuenta" : "Recuperar contraseña";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-shell p-4">
      <div className="w-full max-w-md">
        <Panel title={title}>
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
              <button type="button" className={primaryButtonClass} onClick={() => switchMode("login")}>
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              action={mode === "login" ? "/api/auth/sign-in" : undefined}
              method={mode === "login" ? "post" : undefined}
              onSubmit={handleSubmit}
            >
              {mode === "login" ? (
                <input type="hidden" name="nextPath" value={searchParams.get("next") || ""} />
              ) : null}
              {mode === "signup" ? (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-black uppercase text-slate-400">Empresa</span>
                    <input
                      className={inputClass}
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Nombre de la empresa"
                      required
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black uppercase text-slate-400">Nombre</span>
                    <input
                      className={inputClass}
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Tu nombre"
                    />
                  </label>
                </>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase text-slate-400">Correo</span>
                <input
                  className={inputClass}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black uppercase text-slate-400">Contrasena</span>
                <input
                  className={inputClass}
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
                  {error}
                </p>
              ) : null}

              <button type="submit" className={primaryButtonClass} disabled={loading}>
                {mode === "login" ? "Entrar" : "Registrar empresa"}
              </button>

              {mode === "login" ? (
                <button type="button" className={secondaryButtonClass} onClick={() => switchMode("recover")}>
                  Olvidé mi contraseña
                </button>
              ) : null}

              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-slate-400">
            <Link href="/" className="underline">
              Volver al inicio
            </Link>
            {isPlatformAdmin ? (
              <>
                {" · "}
                <Link href="/platform" className="font-bold text-emerald-300 underline">
                  Panel plataforma
                </Link>
              </>
            ) : null}
          </p>
        </Panel>
      </div>
    </main>
  );
}
