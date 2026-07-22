"use server";

import { requireAppSession } from "@/lib/auth/session";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { recordActivityHistory } from "@/lib/activity-history";
import { canAccessCustomersSession } from "@/lib/customers/load";
import { normalizePersonName } from "@/lib/person-name";
import {
  assertCustomersImportGroupsShape,
  CUSTOMERS_IMPORT_TEMPLATE_FILENAME,
  type CustomersImportGroup,
} from "@/lib/import/customers-import-schema";
import { parseCustomersImportWorkbook } from "@/lib/import/customers-import-parse";
import { buildCustomersImportXlsx } from "@/lib/import/customers-import-template";

export type CustomersImportPreviewResult = {
  groups: CustomersImportGroup[];
  rowErrors: Array<{ rowNumber: number; message: string }>;
  headerErrors: string[];
  validSenderCount: number;
  validRecipientCount: number;
  totalDataRows: number;
};

export type CustomersImportCommitResult = {
  createdCustomers: number;
  createdRecipients: number;
  skippedErrors: Array<{ rowNumber: number; message: string }>;
};

function normalizeEmailList(input?: string[]) {
  return Array.from(
    new Set((input || []).map((email) => email.trim().toLowerCase()).filter(Boolean)),
  );
}

export async function downloadCustomersImportTemplateAction(): Promise<
  ActionResult<{ filename: string; base64: string }>
> {
  try {
    const session = await requireAppSession();
    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const buffer = await buildCustomersImportXlsx();
    return ok({
      filename: CUSTOMERS_IMPORT_TEMPLATE_FILENAME,
      base64: buffer.toString("base64"),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function previewCustomersImportAction(
  formData: FormData,
): Promise<ActionResult<CustomersImportPreviewResult>> {
  try {
    const session = await requireAppSession();
    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("Selecciona un archivo Excel (.xlsx).");
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx")) {
      return fail("Solo se aceptan archivos .xlsx.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseCustomersImportWorkbook(buffer);

    return ok({
      groups: parsed.groups,
      rowErrors: parsed.rowErrors,
      headerErrors: parsed.headerErrors,
      validSenderCount: parsed.validSenderCount,
      validRecipientCount: parsed.validRecipientCount,
      totalDataRows: parsed.totalDataRows,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function importCustomersFromRowsAction(input: {
  groups: CustomersImportGroup[];
}): Promise<ActionResult<CustomersImportCommitResult>> {
  try {
    const session = await requireAppSession();
    if (!canAccessCustomersSession(session)) {
      throw new Error("FORBIDDEN");
    }

    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const groups = input.groups || [];
    if (!groups.length) {
      return fail("No hay remitentes válidos para importar.");
    }

    const shapeErrors = assertCustomersImportGroupsShape(groups);
    if (shapeErrors.length) {
      return fail(shapeErrors[0]?.message || "Datos de importación inválidos.");
    }

    const { data: countries, error: countriesError } = await supabase
      .from("pricing_countries")
      .select("id, name")
      .eq("organization_id", session.organizationId);

    if (countriesError) {
      return fail(countriesError.message);
    }

    const countryByName = new Map(
      (countries || []).map((country) => [String(country.name).trim(), country.id as string]),
    );

    const skippedErrors: Array<{ rowNumber: number; message: string }> = [];
    let createdCustomers = 0;
    let createdRecipients = 0;

    for (const group of groups) {
      const phones = [group.sender.phone.trim()].filter(Boolean);
      if (!phones.length) {
        skippedErrors.push({
          rowNumber: group.sourceRowNumbers[0] || 0,
          message: `Remitente ${group.clave}: falta teléfono.`,
        });
        continue;
      }

      const emails = normalizeEmailList([group.sender.email || ""]);
      const firstName = normalizePersonName(group.sender.firstName);
      const lastName = normalizePersonName(group.sender.lastName);

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          organization_id: session.organizationId,
          first_name: firstName,
          last_name: lastName,
          phones,
          email: emails[0] || "",
          emails,
          street: group.sender.street.trim(),
          house_number: group.sender.houseNumber.trim(),
          neighborhood: group.sender.neighborhood.trim(),
          city: group.sender.city.trim(),
          state: group.sender.state.trim(),
          postal_code: group.sender.postalCode.trim(),
          address_reference: group.sender.addressReference.trim(),
          country: group.sender.country.trim() || "USA",
        })
        .select("id")
        .single();

      if (customerError || !customer) {
        skippedErrors.push({
          rowNumber: group.sourceRowNumbers[0] || 0,
          message: `Remitente ${group.clave}: ${customerError?.message || "no se pudo crear"}.`,
        });
        continue;
      }

      createdCustomers += 1;

      for (const recipient of group.recipients) {
        const countryName = recipient.country.trim();
        const countryId = countryByName.get(countryName);
        if (!countryId) {
          skippedErrors.push({
            rowNumber: recipient.sourceRowNumber,
            message: `Destinatario de ${group.clave}: crea primero el país destino "${countryName}".`,
          });
          continue;
        }

        const recipientEmails = normalizeEmailList([recipient.email || ""]);
        const { error: recipientError } = await supabase.from("customer_recipients").insert({
          organization_id: session.organizationId,
          customer_id: customer.id,
          country_id: countryId,
          first_name: normalizePersonName(recipient.firstName),
          last_name: normalizePersonName(recipient.lastName),
          phone: recipient.phone.trim(),
          email: recipientEmails[0] || "",
          emails: recipientEmails,
          country: countryName,
          street: recipient.street.trim(),
          house_number: recipient.houseNumber.trim(),
          neighborhood: recipient.neighborhood.trim(),
          city: recipient.city.trim(),
          state: recipient.state.trim(),
          postal_code: recipient.postalCode.trim(),
          address_reference: recipient.addressReference.trim(),
        });

        if (recipientError) {
          skippedErrors.push({
            rowNumber: recipient.sourceRowNumber,
            message: `Destinatario de ${group.clave}: ${recipientError.message}.`,
          });
          continue;
        }

        createdRecipients += 1;
      }
    }

    await recordActivityHistory(supabase, session, {
      action: "customer.import",
      entityType: "customer",
      title: `Importación: ${createdCustomers} remitentes, ${createdRecipients} destinatarios`,
      description:
        skippedErrors.length > 0
          ? `${skippedErrors.length} fila(s) con error al guardar`
          : "Importación completada",
      metadata: {
        createdCustomers,
        createdRecipients,
        skippedErrorCount: skippedErrors.length,
      },
    });

    if (createdCustomers === 0 && createdRecipients === 0) {
      return fail(
        skippedErrors[0]?.message || "No se pudo importar ningún remitente ni destinatario.",
      );
    }

    return ok({
      createdCustomers,
      createdRecipients,
      skippedErrors,
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
