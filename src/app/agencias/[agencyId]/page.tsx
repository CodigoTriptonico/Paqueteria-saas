import { notFound } from "next/navigation";
import { loadCommercialAdminAction } from "@/app/actions/commercial-config";
import { CommercialAdminClient } from "@/components/commercial/commercial-admin-client";
import { requirePathAccess } from "@/lib/auth/require";

export default async function AgenciaTarifasPage({ params }: { params: Promise<{ agencyId: string }> }) {
  await requirePathAccess("/agencias");
  const { agencyId } = await params;
  const result = await loadCommercialAdminAction();
  if (!result.ok || !result.data.entities.some((entity) => entity.type === "agency" && entity.id === agencyId)) notFound();
  return <CommercialAdminClient initialData={result.data} initialAudience="agency" selectedEntityId={agencyId} />;
}
