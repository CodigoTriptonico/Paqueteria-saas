import { VentaClient } from "@/components/venta-client";
import { requirePathAccess } from "@/lib/auth/require";
import { loadVentaBootstrap } from "@/lib/sale/bootstrap";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function VentaPage() {
  const session = await requirePathAccess("/venta");

  if (!isSupabaseConfigured() || !session) {
    return <VentaClient />;
  }

  let initialData;

  try {
    initialData = await loadVentaBootstrap(session);
  } catch {
    initialData = undefined;
  }

  return <VentaClient initialData={initialData} />;
}
