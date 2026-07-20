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
  email: string;
  emails: string[];
  country: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  addressReference: string;
  cardStyle: string;
  placeId: string;
  formattedAddress: string;
  addressVerified: boolean;
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
  emails: string[];
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressReference: string;
  cardStyle: string;
  placeId: string;
  formattedAddress: string;
  addressVerified: boolean;
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
  emails?: string[] | null;
  street: string;
  house_number: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_reference?: string | null;
  card_style: string | null;
  place_id?: string | null;
  formatted_address?: string | null;
  address_verified?: boolean | null;
  lat?: number | string | null;
  lng?: number | string | null;
  customer_recipients: RecipientDbRow[] | null;
};

type RecipientDbRow = {
  id: string;
  customer_id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  emails?: string[] | null;
  country: string;
  street: string;
  house_number: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  address_reference?: string | null;
  card_style: string | null;
  place_id?: string | null;
  formatted_address?: string | null;
  address_verified?: boolean | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

const RECIPIENT_SELECT_FIELDS = `
  id,
  customer_id,
  first_name,
  last_name,
  phone,
  email,
  emails,
  country,
  street,
  house_number,
  neighborhood,
  city,
  state,
  postal_code,
  address_reference,
  card_style,
  place_id,
  formatted_address,
  address_verified,
  lat,
  lng
`;

const CUSTOMER_SELECT_FIELDS = `
  id,
  referred_by_customer_id,
  first_name,
  last_name,
  phones,
  email,
  emails,
  street,
  house_number,
  neighborhood,
  city,
  state,
  postal_code,
  country,
  address_reference,
  card_style,
  place_id,
  formatted_address,
  address_verified,
  lat,
  lng
`;

export function groupRecipientsByCustomerId(recipients: RecipientDbRow[]) {
  const grouped = new Map<string, RecipientDbRow[]>();

  for (const recipient of recipients) {
    const customerId = recipient.customer_id;
    if (!customerId) {
      continue;
    }

    const bucket = grouped.get(customerId);
    if (bucket) {
      bucket.push(recipient);
    } else {
      grouped.set(customerId, [recipient]);
    }
  }

  return grouped;
}

export function mergeCustomersWithRecipients(
  customers: CustomerDbRow[],
  recipients: RecipientDbRow[],
): CustomerWithRecipientsRow[] {
  const grouped = groupRecipientsByCustomerId(recipients);

  return customers.map((row) =>
    mapCustomerRow({
      ...row,
      customer_recipients: grouped.get(row.id) || [],
    }),
  );
}

async function listRecipientsForCustomerIds(
  supabase: NonNullable<Awaited<ReturnType<typeof createScopedSupabase>>>,
  session: AppSession,
  customerIds: string[],
) {
  if (!customerIds.length) {
    return [] as RecipientDbRow[];
  }

  const { data, error } = await supabase
    .from("customer_recipients")
    .select(RECIPIENT_SELECT_FIELDS)
    .eq("organization_id", session.organizationId)
    .in("customer_id", customerIds);

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  return (data || []) as RecipientDbRow[];
}

export async function listRecipientsForCustomerSession(
  session: AppSession,
  customerId: string,
): Promise<CustomerRecipientRow[]> {
  if (!canAccessCustomersSession(session)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }

  const recipients = await listRecipientsForCustomerIds(supabase, session, [customerId]);
  return recipients.map(mapRecipientRow);
}

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
  const emails = row.emails?.length ? row.emails : row.email ? [row.email] : [];
  const primaryEmail = emails[0] || row.email || "";

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: primaryEmail,
    emails,
    country: row.country,
    street: row.street,
    houseNumber: row.house_number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state || "",
    postalCode: row.postal_code,
    addressReference: row.address_reference || "",
    cardStyle: row.card_style || "amber-warm",
    placeId: row.place_id || "",
    formattedAddress: row.formatted_address || "",
    addressVerified: Boolean(row.address_verified),
    lat: mapGeoNumber(row.lat),
    lng: mapGeoNumber(row.lng),
  };
}

export function mapCustomerRow(row: CustomerDbRow): CustomerWithRecipientsRow {
  const recipients = (row.customer_recipients || [])
    .filter((recipient) => recipient)
    .map(mapRecipientRow);
  const emails = row.emails?.length ? row.emails : row.email ? [row.email] : [];
  const primaryEmail = emails[0] || row.email || "";

  return {
    id: row.id,
    referredByCustomerId: row.referred_by_customer_id || "",
    firstName: row.first_name,
    lastName: row.last_name,
    phones: row.phones?.length ? row.phones : [""],
    email: primaryEmail,
    emails,
    street: row.street,
    houseNumber: row.house_number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    addressReference: row.address_reference || "",
    cardStyle: row.card_style || "amber-warm",
    placeId: row.place_id || "",
    formattedAddress: row.formatted_address || "",
    addressVerified: Boolean(row.address_verified),
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
    .select(CUSTOMER_SELECT_FIELDS)
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

  const customers = (data || []) as CustomerDbRow[];
  const recipients = await listRecipientsForCustomerIds(
    supabase,
    session,
    customers.map((row) => row.id),
  );

  return mergeCustomersWithRecipients(customers, recipients);
}
