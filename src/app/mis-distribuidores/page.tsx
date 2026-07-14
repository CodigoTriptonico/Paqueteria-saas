import { loadAcquisitionPortfolioAction } from "@/app/actions/distribution";
import { AcquisitionWorkspace } from "@/components/distribution/acquisition-workspace";
import { requirePathAccess } from "@/lib/auth/require";

export default async function MisDistribuidoresPage() {
  await requirePathAccess("/mis-distribuidores");
  const result = await loadAcquisitionPortfolioAction();
  return <AcquisitionWorkspace initialPartners={result.ok ? result.data : null} />;
}
