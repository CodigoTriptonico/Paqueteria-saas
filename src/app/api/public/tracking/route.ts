import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  PUBLIC_TRACKING_ERROR,
  lastFourDigits,
  normalizeTrackingCode,
  publicTrackingShipment,
  senderPhoneMatches,
  type PublicTrackingLookupRow,
} from "@/lib/public-tracking";
import { enforcePublicTrackingRateLimit, isRateLimitError } from "@/lib/security/api-guards";

const TRACKING_SELECT = `
  id, code, customer_name, country, carrier, paid, status, created_at,
  empty_box_delivered_at, full_box_collected_at, office_received_at, departed_at, shipped_at, delivered_at,
  logistics_plan, recipient_snapshot,
  customer:customers!shipments_customer_id_fkey(first_name, last_name, phones, street, house_number, neighborhood, city, state, postal_code, country, formatted_address),
  shipment_payments(amount, method, created_at)
`;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { code?: unknown; phoneLastFour?: unknown } | null;
  const code = normalizeTrackingCode(body?.code);
  const phoneLastFour = lastFourDigits(body?.phoneLastFour);

  if (!code || phoneLastFour.length !== 4) {
    return NextResponse.json({ ok: false, error: PUBLIC_TRACKING_ERROR }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Servicio no disponible." }, { status: 503 });
  }

  try {
    await enforcePublicTrackingRateLimit(request.headers, code);
  } catch (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 429 });
    }
    console.error("[public/tracking] rate limit error", error);
    return NextResponse.json({ ok: false, error: "Servicio temporalmente no disponible." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Servicio no disponible." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("shipments")
    .select(TRACKING_SELECT)
    .eq("code", code)
    .limit(20);

  if (error) {
    console.error("[public/tracking] lookup error", { code: error.code, message: error.message });
    return NextResponse.json({ ok: false, error: "Servicio temporalmente no disponible." }, { status: 503 });
  }

  const matched = (data || []).find((candidate) =>
    senderPhoneMatches((candidate as PublicTrackingLookupRow).customer, phoneLastFour),
  );
  const row = matched as (PublicTrackingLookupRow & { id: string }) | undefined;

  if (!row) {
    return NextResponse.json({ ok: false, error: PUBLIC_TRACKING_ERROR }, { status: 404 });
  }

  const shipment = publicTrackingShipment(row);
  const { data: packages } = await admin
    .from("shipment_packages")
    .select("code, provider_name, provider_tracking_number, provider_tracking_url")
    .eq("shipment_id", row.id);

  shipment.providerTracking = (packages || []).map((pkg) => ({
    code: String(pkg.code || ""),
    provider: String(pkg.provider_name || ""),
    number: String(pkg.provider_tracking_number || ""),
    url: String(pkg.provider_tracking_url || ""),
  })).filter((pkg) => pkg.number || pkg.url);

  return NextResponse.json({ ok: true, shipment });
}
