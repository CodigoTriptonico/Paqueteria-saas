"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { getCurrentSessionAction } from "@/app/actions/session";
import { inputClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result =
      mode === "login"
        ? await signInAction(email, password)
        : await signUpAction(email, password, organizationName, fullName);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace(searchParams.get("next") || "/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-shell p-4">
      <div className="w-full max-w-md">
        <Panel title={mode === "login" ? "Iniciar sesion" : "Crear cuenta"}>
          <form className="grid gap-4" onSubmit={handleSubmit}>
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
              {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Registrar empresa"}
            </button>

            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
            </button>
          </form>

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
