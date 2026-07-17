import { loadBusinessWorkspaceAction } from "@/app/actions/business-workspace";
import { BusinessCommandCenter, type BusinessSurface } from "@/components/business/business-command-center";
import { requirePathAccess } from "@/lib/auth/require";
import { emptyBusinessWorkspace } from "@/lib/business/workspace";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function BusinessPage({ pathname, surface }: { pathname: string; surface: BusinessSurface }) {
  const session = await requirePathAccess(pathname);
  const result = isSupabaseConfigured() && session ? await loadBusinessWorkspaceAction() : null;
  const fallback = emptyBusinessWorkspace({
    tenantId: null,
    tenantName: session?.organizationName ?? "Empresa",
    organizationId: session?.organizationId ?? "local",
    organizationName: session?.organizationName ?? "Empresa",
    organizationCode: null,
    organizationType: surface === "agency" ? "agency" : "matrix",
  });

  return (
    <>
      {result && !result.ok ? (
        <div className="mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-[1600px] rounded-lg border border-amber-800/60 bg-amber-950/25 px-4 py-3 text-sm font-bold text-amber-100">
          No se pudo cargar el modelo empresarial: {result.error}
        </div>
      ) : null}
      <BusinessCommandCenter
        surface={surface}
        workspace={result?.ok ? result.data : fallback}
        canManageAgencyTeam={session?.roleSlug === "administrador_agencia"}
      />
    </>
  );
}
