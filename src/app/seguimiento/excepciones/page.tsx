import { loadControlledOperationsAction } from "@/app/actions/controlled-operations";
import { ControlledOperationsClient } from "@/components/controlled-operations-client";
import { requirePathAccess } from "@/lib/auth/require";

export default async function ControlledOperationsPage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  await requirePathAccess("/seguimiento/excepciones");
  const { package: packageId } = await searchParams;
  const result = await loadControlledOperationsAction(packageId);
  return <ControlledOperationsClient packageId={packageId} initialHandoffs={result.ok ? result.data.handoffs : []} initialExceptions={result.ok ? result.data.exceptions : []} initialCustody={result.ok ? result.data.custody : []} />;
}
