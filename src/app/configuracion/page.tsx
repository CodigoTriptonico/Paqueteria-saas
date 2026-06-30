import { ConfiguracionClient } from "@/components/configuracion-client";
import { requirePathAccess } from "@/lib/auth/require";
import { loadPricingConfigForSession } from "@/lib/pricing/load-config";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ConfiguracionPage() {
  const session = await requirePathAccess("/configuracion");

  if (!isSupabaseConfigured() || !session) {
    return <ConfiguracionClient />;
  }

  let initialPricing;

  try {
    initialPricing = await loadPricingConfigForSession(session);
  } catch {
    initialPricing = undefined;
  }

  return <ConfiguracionClient initialPricing={initialPricing} />;
}
