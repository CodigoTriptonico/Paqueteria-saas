import { AgencyTeamPanel } from "@/components/business/agency-team-panel";
import { requirePathAccess } from "@/lib/auth/require";

export default async function AgencyTeamPage() {
  await requirePathAccess("/agencia/equipo");
  return <AgencyTeamPanel />;
}
