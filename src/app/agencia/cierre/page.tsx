import { loadAgencyDailyCloseAction } from "@/app/actions/controlled-operations";
import { AgencyDailyCloseClient } from "@/components/agency-daily-close-client";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requirePathAccess } from "@/lib/auth/require";

export default async function AgencyDailyClosePage() {
  const session = await requirePathAccess("/agencia/cierre");
  const result = await loadAgencyDailyCloseAction();
  return <AgencyDailyCloseClient initialClose={result.ok ? result.data : null} canPrepare={sessionHasPermission(session, "agency.daily_close.prepare")} canFinalize={sessionHasPermission(session, "agency.daily_close.finalize")} />;
}
