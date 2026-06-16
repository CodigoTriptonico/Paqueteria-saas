"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";

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
};

function canAccessCustomers(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "sales.manage") ||
    sessionHasPermission(session, "customers.manage")
  );
}

function mapRecipient(row: RecipientDbRow): CustomerRecipientRow {
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
  };
}

function mapCustomer(row: CustomerDbRow): CustomerWithRecipientsRow {
  const recipients = (row.customer_recipients || [])
    .filter((recipient) => recipient)
    .map(mapRecipient);

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
    recipients,
  };
}

export async function listCustomersWithRecipientsAction(): Promise<
  ActionResult<CustomerWithRecipientsRow[]>
> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
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
          postal_code
        )
      `,
      )
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        return ok([]);
      }
      return fail(error.message);
    }

    return ok((data || []).map((row) => mapCustomer(row as CustomerDbRow)));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createCustomerAction(input: {
  firstName: string;
  lastName: string;
  phones: string[];
  email?: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  referredByCustomerId?: string;
}): Promise<ActionResult<CustomerWithRecipientsRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const phones = input.phones.map((phone) => phone.trim()).filter(Boolean);
    if (!phones.length) {
      return fail("Agrega al menos un telefono");
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: session.organizationId,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phones,
        email: input.email?.trim() || "",
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        postal_code: input.postalCode.trim(),
        country: input.country?.trim() || "USA",
        referred_by_customer_id: input.referredByCustomerId || null,
      })
      .select(
        "id, referred_by_customer_id, first_name, last_name, phones, email, street, house_number, neighborhood, city, state, postal_code, country",
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear el cliente");
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.created",
      entityType: "customer",
      entityId: data.id,
      title: `Cliente creado: ${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      description: phones.join(", "),
    });

    return ok({
      ...mapCustomer({ ...data, customer_recipients: [] } as CustomerDbRow),
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
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}): Promise<ActionResult<CustomerWithRecipientsRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const phones = input.phones.map((phone) => phone.trim()).filter(Boolean);
    if (!phones.length) {
      return fail("Agrega al menos un telefono");
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phones,
        email: input.email?.trim() || "",
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        postal_code: input.postalCode.trim(),
        country: input.country?.trim() || "USA",
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
        street,
        house_number,
        neighborhood,
        city,
        state,
        postal_code,
        country,
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
          postal_code
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
      title: `Cliente editado: ${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      description: phones.join(", "),
    });

    return ok(mapCustomer(data as CustomerDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deactivateCustomerAction(customerId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
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
  country: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
}): Promise<ActionResult<CustomerRecipientRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customer_recipients")
      .insert({
        organization_id: session.organizationId,
        customer_id: input.customerId,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone.trim(),
        country: input.country.trim(),
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state?.trim() || "",
        postal_code: input.postalCode.trim(),
      })
      .select(
        "id, first_name, last_name, phone, country, street, house_number, neighborhood, city, state, postal_code",
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo crear el destinatario");
    }

    await recordActivityHistory(supabase, session, {
      action: "recipient.created",
      entityType: "recipient",
      entityId: data.id,
      title: `Destinatario creado: ${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      description: `${input.country.trim()} · ${input.phone.trim()}`,
      metadata: { customerId: input.customerId },
    });

    return ok(mapRecipient(data as RecipientDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateRecipientAction(input: {
  recipientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
}): Promise<ActionResult<CustomerRecipientRow>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const { data, error } = await supabase
      .from("customer_recipients")
      .update({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone.trim(),
        country: input.country.trim(),
        street: input.street.trim(),
        house_number: input.houseNumber.trim(),
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        state: input.state?.trim() || "",
        postal_code: input.postalCode.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.recipientId)
      .eq("organization_id", session.organizationId)
      .select(
        "id, first_name, last_name, phone, country, street, house_number, neighborhood, city, state, postal_code",
      )
      .single();

    if (error || !data) {
      return fail(error?.message || "No se pudo actualizar el destinatario");
    }

    await recordActivityHistory(supabase, session, {
      action: "recipient.updated",
      entityType: "recipient",
      entityId: data.id,
      title: `Destinatario editado: ${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      description: `${input.country.trim()} · ${input.phone.trim()}`,
    });

    return ok(mapRecipient(data as RecipientDbRow));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function deleteRecipientAction(recipientId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();

    if (!canAccessCustomers(session)) {
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
