import { AgencyRateAdminPanel } from "@/components/business/agency-rate-admin-panel";
import { requirePathAccess } from "@/lib/auth/require";

export default async function AgenciaTarifasPage({ params }: { params: Promise<{ agencyId: string }> }) {
  await requirePathAccess("/agencias");
  const { agencyId } = await params;
  return <AgencyRateAdminPanel agencyId={agencyId} />;
}
