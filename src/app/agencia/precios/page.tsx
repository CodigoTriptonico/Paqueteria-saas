import { AgencyPublicPricePanel } from "@/components/business/agency-public-price-panel";
import { requirePathAccess } from "@/lib/auth/require";

export default async function AgenciaPreciosPage() {
  await requirePathAccess("/agencia");
  return <AgencyPublicPricePanel />;
}
