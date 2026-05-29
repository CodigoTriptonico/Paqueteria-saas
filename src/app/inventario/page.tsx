import { InventarioClient } from "@/components/inventario-client";
import { requirePathAccess } from "@/lib/auth/require";

export default async function InventarioPage() {
  await requirePathAccess("/inventario");

  return <InventarioClient />;
}
