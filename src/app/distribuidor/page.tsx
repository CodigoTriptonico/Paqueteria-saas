import { DistributionWorkspace } from "@/components/distribution/distribution-workspace";
import { loadDistributionWorkspaceAction } from "@/app/actions/distribution";
import { requirePathAccess } from "@/lib/auth/require";

export default async function DistribuidorPage() {
  await requirePathAccess("/distribuidor");
  const result = await loadDistributionWorkspaceAction();
  return <DistributionWorkspace initialWorkspace={result.ok ? result.data : null} />;
}
