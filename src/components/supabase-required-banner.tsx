import Link from "next/link";

type SupabaseRequiredBannerProps = {
  title?: string;
  detail?: string;
};

export function SupabaseRequiredBanner({
  title = "Supabase no configurado",
  detail = "Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en .env.local. Los datos se cargan solo desde la base de datos.",
}: SupabaseRequiredBannerProps) {
  return (
    <div className="mb-4 rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3">
      <p className="text-sm font-black text-amber-100">{title}</p>
      <p className="mt-1 text-xs font-bold text-amber-200/90">{detail}</p>
      <p className="mt-2 text-xs font-bold text-slate-400">
        Guía:{" "}
        <Link href="/login" className="text-emerald-300 underline">
          iniciar sesión
        </Link>{" "}
        tras configurar el proyecto. Ver SETUP.md en el repositorio.
      </p>
    </div>
  );
}
