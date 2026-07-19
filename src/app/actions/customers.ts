"use server";

import { requireAppSession } from "@/lib/auth/session";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { isSalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import {
  canAccessCustomersSession,
  listCustomersForSession,
  listRecipientsForCustomerSession,
  mapCustomerRow,
  mapRecipientRow,
  type CustomerRecipientRow,
  type CustomerWithRecipientsRow,
} from "@/lib/customers/load";
import type { ListCustomersParams } from "@/lib/customers/list-params";
import { assertSameOrgCustomerIds } from "@/lib/security/org-scope";
import { normalizePersonName } from "@/lib/person-name";

export type { CustomerRecipientRow, CustomerWithRecipientsRow } from "@/lib/customers/load";

type CustomerDbRow = Parameters<typeof mapCustomerRow>[0];
type RecipientDbRow = Parameters<typeof mapRecipientRow>[0];

type GeoAddressInput = {
  placeId?: string;
  formattedAddress?: string;
  addressVerified?: boolean;
  lat?: number | null;
  lng?: number | null;
};

function geoAddressPatch(input: GeoAddressInput) {
  const hasGeo =
    typeof input.lat === "number" &&
    Number.isFinite(input.lat) &&
    typeof input.lng === "number" &&
    Number.isFinite(input.lng);

  return {
    place_id: input.placeId?.trim() || null,
    formatted_address: input.formattedAddress?.trim() || null,
    address_verified: Boolean(input.addressVerified),
    lat: hasGeo ? input.lat : null,
    lng: hasGeo ? input.lng : null,
    geo_updated_at: hasGeo ? new Date().toISOString() : null,
  };
}

function normalizeEmailList(input?: string[]) {
  return Array.from(
    new Set((input || []).map((email) => email.trim().toLowerCase()).filter(Boolean)),
  );
}

export async function listCustomersWithRecipientsAction(
  params?: ListCustomersParams,
): Promise<ActionResult<CustomerWithRecipientsRow[]>> {
  try {
    const session = await requireAppSession();
    const data = await listCustomersForSession(session, params);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function listRecipientsForCustomerAction(
  customerId: string,
): Promise<ActionResult<CustomerRecipientRow[]>> {
  try {
    const session = await requireAppSession();
    const data = await listRecipientsForCustomerSession(session, customerId);
    return ok(data);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createCustomerAction(input: {
  firstName: string;
  lastName: string;
  phones: string[];
  email?: string;
  emails?: string[];
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  referredByCustomerId?: string;
  placeId?: string;
  formattedAddress?: string;
  addressVerified?: boolean;
  lat?: number | null;
  lng?: number | null;
}): Promise<ActionResult<CustomerWithRecipientsRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const phones = input.phones.map((phone) => phone.trim()).filter(Boolean);
    const emails = normalizeEmailList(input.emails?.length ? input.emails : [input.email || ""]);
    const firstName = normalizePersonName(input.firstName);
    const lastName = normalizePersonName(input.lastName);
    if (!phones.length) {
      return fail("Agrega al menos un telefono");
    }

    await assertSameOrgCustomerIds(supabase, session.organizationId, [
      input.referredByCustomerId || "",
    ]);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: session.organizationId,
        first_name: firstName,
        last_name: lastName,
        phones,
        email: emails[0] || "",
        emails,
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        postal_code: input.postalCode.trim(),
        country: input.country?.trim() || "USA",
        referred_by_customer_id: input.referredByCustomerId || null,
        ...geoAddressPatch(input),
      })
      .select(
        "id, referred_by_customer_id, first_name, last_name, phones, email, emails, street, house_number, neighborhood, city, state, postal_code, country, card_style, place_id, formatted_address, address_verified, lat, lng",
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear el cliente");
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.created",
      entityType: "customer",
      entityId: data.id,
      title: `Cliente creado: ${firstName} ${lastName}`.trim(),
      description: phones.join(", "),
    });

    return ok({
      ...mapCustomerRow({ ...data, customer_recipients: [] } as CustomerDbRow),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateCustomerAction(input: {
  customerId: string;
  firstName: string;
  lastName: string;
  phones: string[];
  email?: string;
  emails?: string[];
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  placeId?: string;
  formattedAddress?: string;
  addressVerified?: boolean;
  lat?: number | null;
  lng?: number | null;
}): Promise<ActionResult<CustomerWithRecipientsRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const phones = input.phones.map((phone) => phone.trim()).filter(Boolean);
    const emails = normalizeEmailList(input.emails?.length ? input.emails : [input.email || ""]);
    const firstName = normalizePersonName(input.firstName);
    const lastName = normalizePersonName(input.lastName);
    if (!phones.length) {
      return fail("Agrega al menos un telefono");
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        phones,
        email: emails[0] || "",
        emails,
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        postal_code: input.postalCode.trim(),
        country: input.country?.trim() || "USA",
        ...geoAddressPatch(input),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.customerId)
      .eq("organization_id", session.organizationId)
      .select(
        `
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
        card_style,
        place_id,
        formatted_address,
        address_verified,
        lat,
        lng,
        customer_recipients (
          id,
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
          card_style,
          place_id,
          formatted_address,
          address_verified,
          lat,
          lng
        )
      `,
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar el cliente");
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.updated",
      entityType: "customer",
      entityId: data.id,
      title: `Cliente editado: ${firstName} ${lastName}`.trim(),
      description: phones.join(", "),
    });

    return ok(mapCustomerRow(data as CustomerDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateCustomerCardStyleAction(input: {
  customerId: string;
  cardStyle: string;
}): Promise<ActionResult<{ cardStyle: string }>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    if (!isSalePersonCardVariantId(input.cardStyle)) {
      return fail("Estilo de tarjeta no válido");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        card_style: input.cardStyle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.customerId)
      .eq("organization_id", session.organizationId)
      .select("id, card_style")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar el estilo");
    }

    return ok({ cardStyle: data.card_style || input.cardStyle });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateRecipientCardStyleAction(input: {
  recipientId: string;
  cardStyle: string;
}): Promise<ActionResult<{ cardStyle: string }>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    if (!isSalePersonCardVariantId(input.cardStyle)) {
      return fail("Estilo de tarjeta no válido");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customer_recipients")
      .update({
        card_style: input.cardStyle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.recipientId)
      .eq("organization_id", session.organizationId)
      .select("id, card_style")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar el estilo");
    }

    return ok({ cardStyle: data.card_style || input.cardStyle });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateCustomerAction(customerId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("organization_id", session.organizationId)
      .select("id, first_name, last_name, phones")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo eliminar el cliente");
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.deleted",
      entityType: "customer",
      entityId: data.id,
      title: `Cliente eliminado: ${data.first_name} ${data.last_name}`.trim(),
      description: (data.phones || []).join(", "),
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createRecipientAction(input: {
  customerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  emails?: string[];
  country: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
  placeId?: string;
  formattedAddress?: string;
  addressVerified?: boolean;
  lat?: number | null;
  lng?: number | null;
}): Promise<ActionResult<CustomerRecipientRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    await assertSameOrgCustomerIds(supabase, session.organizationId, [input.customerId]);

    const countryName = input.country.trim();
    const { data: country, error: countryError } = await supabase
      .from("pricing_countries")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("name", countryName)
      .maybeSingle();

    if (countryError) {
      return fail(countryError.message);
    }

    if (!country) {
      return fail("Crea primero el país destino del destinatario.");
    }

    const emails = normalizeEmailList(input.emails?.length ? input.emails : [input.email || ""]);
    const firstName = normalizePersonName(input.firstName);
    const lastName = normalizePersonName(input.lastName);

    const { data, error } = await supabase
      .from("customer_recipients")
      .insert({
        organization_id: session.organizationId,
        customer_id: input.customerId,
        country_id: country.id,
        first_name: firstName,
        last_name: lastName,
        phone: input.phone.trim(),
        email: emails[0] || "",
        emails,
        country: input.country.trim(),
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state?.trim() || "",
        postal_code: input.postalCode.trim(),
        ...geoAddressPatch(input),
      })
      .select(
        "id, first_name, last_name, phone, email, emails, country, street, house_number, neighborhood, city, state, postal_code, card_style, place_id, formatted_address, address_verified, lat, lng",
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear el destinatario");
    }

    await recordActivityHistory(supabase, session, {
      action: "recipient.created",
      entityType: "recipient",
      entityId: data.id,
      title: `Destinatario creado: ${firstName} ${lastName}`.trim(),
      description: [input.country.trim(), input.phone.trim(), emails[0]].filter(Boolean).join(" · "),
      metadata: { customerId: input.customerId },
    });

    return ok(mapRecipientRow(data as RecipientDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateRecipientAction(input: {
  recipientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  emails?: string[];
  country: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
  placeId?: string;
  formattedAddress?: string;
  addressVerified?: boolean;
  lat?: number | null;
  lng?: number | null;
}): Promise<ActionResult<CustomerRecipientRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const countryName = input.country.trim();
    const { data: country, error: countryError } = await supabase
      .from("pricing_countries")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("name", countryName)
      .maybeSingle();

    if (countryError) {
      return fail(countryError.message);
    }

    if (!country) {
      return fail("Crea primero el país destino del destinatario.");
    }

    const emails = normalizeEmailList(input.emails?.length ? input.emails : [input.email || ""]);
    const firstName = normalizePersonName(input.firstName);
    const lastName = normalizePersonName(input.lastName);

    const { data, error } = await supabase
      .from("customer_recipients")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: input.phone.trim(),
        email: emails[0] || "",
        emails,
        country_id: country.id,
        country: input.country.trim(),
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state?.trim() || "",
        postal_code: input.postalCode.trim(),
        ...geoAddressPatch(input),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.recipientId)
      .eq("organization_id", session.organizationId)
      .select(
        "id, first_name, last_name, phone, email, emails, country, street, house_number, neighborhood, city, state, postal_code, card_style, place_id, formatted_address, address_verified, lat, lng",
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar el destinatario");
    }

    await recordActivityHistory(supabase, session, {
      action: "recipient.updated",
      entityType: "recipient",
      entityId: data.id,
      title: `Destinatario editado: ${firstName} ${lastName}`.trim(),
      description: [input.country.trim(), input.phone.trim(), emails[0]].filter(Boolean).join(" · "),
    });

    return ok(mapRecipientRow(data as RecipientDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deleteRecipientAction(recipientId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customer_recipients")
      .delete()
      .eq("id", recipientId)
      .eq("organization_id", session.organizationId)
      .select("id, first_name, last_name, phone, country")
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo eliminar el destinatario");
    }

    await recordActivityHistory(supabase, session, {
      action: "recipient.deleted",
      entityType: "recipient",
      entityId: data.id,
      title: `Destinatario eliminado: ${data.first_name} ${data.last_name}`.trim(),
      description: `${data.country} · ${data.phone}`,
    });

    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
