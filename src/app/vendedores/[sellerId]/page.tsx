import { notFound } from "next/navigation";
import { loadCommercialAdminAction } from "@/app/actions/commercial-config";
import { CommercialAdminClient } from "@/components/commercial/commercial-admin-client";
import { requirePathAccess } from "@/lib/auth/require";

export default async function VendedorCommercialPage({ params }: { params: Promise<{ sellerId: string }> }) {
  await requirePathAccess("/vendedores");
  const { sellerId } = await params;
  const result = await loadCommercialAdminAction();
  if (!result.ok || !result.data.entities.some((entity) => entity.type === "seller" && entity.id === sellerId)) notFound();
  return <CommercialAdminClient initialData={result.data} initialAudience="seller" selectedEntityId={sellerId} />;
}
