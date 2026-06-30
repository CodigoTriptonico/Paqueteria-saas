import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  escapeIlikePattern,
  normalizeCustomerListParams,
  type ListCustomersParams,
} from "@/lib/customers/list-params";

export type CustomerRecipientRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  cardStyle: string;
  placeId: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
};

export type CustomerWithRecipientsRow = {
  id: string;
  referredByCustomerId: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  cardStyle: string;
  placeId: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  recipients: CustomerRecipientRow[];
};

type CustomerDbRow = {
  id: string;
  referred_by_customer_id: string | null;
  first_name: string;
  last_name: string;
  phones: string[] | null;
  email: string;
  street: string;
  house_number: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  card_style: string | null;
  place_id?: string | null;
  formatted_address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  customer_recipients: RecipientDbRow[] | null;
};

type RecipientDbRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  street: string;
  house_number: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  card_style: string | null;
  place_id?: string | null;
  formatted_address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

function mapGeoNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function canAccessCustomersSession(session: AppSession) {
  return (
    sessionHasPermission(session, "sales.manage") ||
    sessionHasPermission(session, "customers.manage")
  );
}

export function mapRecipientRow(row: RecipientDbRow): CustomerRecipientRow {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    country: row.country,
    street: row.street,
    houseNumber: row.house_number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state || "",
    postalCode: row.postal_code,
    cardStyle: row.card_style || "amber-warm",
    placeId: row.place_id || "",
    formattedAddress: row.formatted_address || "",
    lat: mapGeoNumber(row.lat),
    lng: mapGeoNumber(row.lng),
  };
}

export function mapCustomerRow(row: CustomerDbRow): CustomerWithRecipientsRow {
  const recipients = (row.customer_recipients || [])
    .filter((recipient) => recipient)
    .map(mapRecipientRow);

  return {
    id: row.id,
    referredByCustomerId: row.referred_by_customer_id || "",
    firstName: row.first_name,
    lastName: row.last_name,
    phones: row.phones?.length ? row.phones : [""],
    email: row.email,
    street: row.street,
    houseNumber: row.house_number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    cardStyle: row.card_style || "amber-warm",
    placeId: row.place_id || "",
    formattedAddress: row.formatted_address || "",
    lat: mapGeoNumber(row.lat),
    lng: mapGeoNumber(row.lng),
    recipients,
  };
}

export async function listCustomersForSession(
  session: AppSession,
  params?: ListCustomersParams,
): Promise<CustomerWithRecipientsRow[]> {
  if (!canAccessCustomersSession(session)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }

  const { limit, offset, query } = normalizeCustomerListParams(params);

  let request = supabase
    .from("customers")
    .select(
      `
        id,
        referred_by_customer_id,
        first_name,
        last_name,
        phones,
        email,
        street,
        house_number,
        neighborhood,
        city,
        state,
        postal_code,
        country,
        card_style,
        place_id,
        formatted_address,
        lat,
        lng,
        customer_recipients (
          id,
          first_name,
          last_name,
          phone,
          country,
          street,
          house_number,
          neighborhood,
          city,
          state,
          postal_code,
          card_style,
          place_id,
          formatted_address,
          lat,
          lng
        )
      `,
    )
    .eq("organization_id", session.organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
    const pattern = `%${escapeIlikePattern(query)}%`;
    request = request.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    );
  }

  const { data, error } = await request;

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []).map((row) => mapCustomerRow(row as CustomerDbRow));
}
