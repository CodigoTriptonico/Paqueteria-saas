import { loadCommercialAdminAction } from "@/app/actions/commercial-config";
import { CommercialAdminClient } from "@/components/commercial/commercial-admin-client";
import { requirePathAccess } from "@/lib/auth/require";

export default async function VendedoresPage() {
  await requirePathAccess("/vendedores");
  const result = await loadCommercialAdminAction();
  if (!result.ok) return <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm font-bold text-amber-100">{result.error}</div>;
  return <CommercialAdminClient initialData={result.data} initialAudience="seller" />;
}
