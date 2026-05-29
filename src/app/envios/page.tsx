import { EnviosClient } from "@/components/envios-client";
import { requirePathAccess } from "@/lib/auth/require";

export default async function EnviosPage() {
  await requirePathAccess("/envios");

  return <EnviosClient />;
}
