/** Fixed Excel column contract for remittentes + destinatarios import. */

export const CUSTOMERS_IMPORT_MAX_ROWS = 500;
export const CUSTOMERS_IMPORT_SHEET_DATA = "Datos";
export const CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS = "Instrucciones";
export const CUSTOMERS_IMPORT_TEMPLATE_FILENAME = "plantilla-remitentes-destinatarios.xlsx";

export const REMITENTE_COLUMNS = [
  "remitente_clave",
  "rem_nombre",
  "rem_apellido",
  "rem_telefono",
  "rem_email",
  "rem_calle",
  "rem_numero",
  "rem_colonia",
  "rem_ciudad",
  "rem_estado",
  "rem_cp",
  "rem_pais",
  "rem_referencia",
] as const;

export const DESTINATARIO_COLUMNS = [
  "dest_nombre",
  "dest_apellido",
  "dest_telefono",
  "dest_pais",
  "dest_email",
  "dest_calle",
  "dest_numero",
  "dest_colonia",
  "dest_ciudad",
  "dest_estado",
  "dest_cp",
  "dest_referencia",
] as const;

export const CUSTOMERS_IMPORT_COLUMNS = [...REMITENTE_COLUMNS, ...DESTINATARIO_COLUMNS] as const;

export type RemitenteColumn = (typeof REMITENTE_COLUMNS)[number];
export type DestinatarioColumn = (typeof DESTINATARIO_COLUMNS)[number];
export type CustomersImportColumn = (typeof CUSTOMERS_IMPORT_COLUMNS)[number];

export type CustomersImportRawRow = Record<CustomersImportColumn, string>;

export type CustomersImportRowError = {
  rowNumber: number;
  message: string;
};

export type CustomersImportSender = {
  clave: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressReference: string;
};

export type CustomersImportRecipient = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  email: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  addressReference: string;
  sourceRowNumber: number;
};

export type CustomersImportGroup = {
  clave: string;
  sender: CustomersImportSender;
  recipients: CustomersImportRecipient[];
  sourceRowNumbers: number[];
};

export type CustomersImportParseResult = {
  groups: CustomersImportGroup[];
  rowErrors: CustomersImportRowError[];
  validSenderCount: number;
  validRecipientCount: number;
  totalDataRows: number;
};

const EMPTY_ROW: CustomersImportRawRow = Object.fromEntries(
  CUSTOMERS_IMPORT_COLUMNS.map((column) => [column, ""]),
) as CustomersImportRawRow;

export function emptyCustomersImportRow(): CustomersImportRawRow {
  return { ...EMPTY_ROW };
}

export function normalizeImportCell(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value).trim();
}

export function hasRecipientSideData(row: CustomersImportRawRow): boolean {
  return DESTINATARIO_COLUMNS.some((column) => row[column].length > 0);
}

export function isBlankImportRow(row: CustomersImportRawRow): boolean {
  return CUSTOMERS_IMPORT_COLUMNS.every((column) => row[column].length === 0);
}

function senderFromRow(row: CustomersImportRawRow): CustomersImportSender {
  return {
    clave: row.remitente_clave,
    firstName: row.rem_nombre,
    lastName: row.rem_apellido,
    phone: row.rem_telefono,
    email: row.rem_email,
    street: row.rem_calle,
    houseNumber: row.rem_numero,
    neighborhood: row.rem_colonia,
    city: row.rem_ciudad,
    state: row.rem_estado,
    postalCode: row.rem_cp,
    country: row.rem_pais || "USA",
    addressReference: row.rem_referencia,
  };
}

function recipientFromRow(row: CustomersImportRawRow, rowNumber: number): CustomersImportRecipient {
  return {
    firstName: row.dest_nombre,
    lastName: row.dest_apellido,
    phone: row.dest_telefono,
    country: row.dest_pais,
    email: row.dest_email,
    street: row.dest_calle,
    houseNumber: row.dest_numero,
    neighborhood: row.dest_colonia,
    city: row.dest_ciudad,
    state: row.dest_estado,
    postalCode: row.dest_cp,
    addressReference: row.dest_referencia,
    sourceRowNumber: rowNumber,
  };
}

/** Validate a single data row. Returns Spanish error messages (empty = ok). */
export function validateCustomersImportRow(
  row: CustomersImportRawRow,
  rowNumber: number,
): CustomersImportRowError[] {
  const errors: CustomersImportRowError[] = [];
  const push = (message: string) => errors.push({ rowNumber, message });

  if (!row.remitente_clave) {
    push("Falta remitente_clave.");
  }
  if (!row.rem_nombre) {
    push("Falta rem_nombre.");
  }
  if (!row.rem_apellido) {
    push("Falta rem_apellido.");
  }
  if (!row.rem_telefono) {
    push("Falta rem_telefono.");
  }

  if (hasRecipientSideData(row)) {
    if (!row.dest_nombre) {
      push("Hay datos de destinatario pero falta dest_nombre.");
    }
    if (!row.dest_apellido) {
      push("Hay datos de destinatario pero falta dest_apellido.");
    }
    if (!row.dest_telefono) {
      push("Hay datos de destinatario pero falta dest_telefono.");
    }
    if (!row.dest_pais) {
      push("Hay datos de destinatario pero falta dest_pais.");
    }
  }

  return errors;
}

export function buildCustomersImportGroups(
  rows: Array<{ rowNumber: number; values: CustomersImportRawRow }>,
): CustomersImportParseResult {
  const rowErrors: CustomersImportRowError[] = [];
  const groupMap = new Map<string, CustomersImportGroup>();
  let totalDataRows = 0;

  if (rows.length > CUSTOMERS_IMPORT_MAX_ROWS) {
    rowErrors.push({
      rowNumber: 0,
      message: `El archivo tiene más de ${CUSTOMERS_IMPORT_MAX_ROWS} filas de datos. Divide el Excel e intenta de nuevo.`,
    });
    return {
      groups: [],
      rowErrors,
      validSenderCount: 0,
      validRecipientCount: 0,
      totalDataRows: rows.length,
    };
  }

  for (const { rowNumber, values } of rows) {
    if (isBlankImportRow(values)) {
      continue;
    }

    totalDataRows += 1;
    const errors = validateCustomersImportRow(values, rowNumber);
    if (errors.length) {
      rowErrors.push(...errors);
      continue;
    }

    const clave = values.remitente_clave;
    let group = groupMap.get(clave);
    if (!group) {
      group = {
        clave,
        sender: senderFromRow(values),
        recipients: [],
        sourceRowNumbers: [],
      };
      groupMap.set(clave, group);
    }

    group.sourceRowNumbers.push(rowNumber);

    if (hasRecipientSideData(values)) {
      group.recipients.push(recipientFromRow(values, rowNumber));
    }
  }

  const groups = Array.from(groupMap.values());
  return {
    groups,
    rowErrors,
    validSenderCount: groups.length,
    validRecipientCount: groups.reduce((sum, group) => sum + group.recipients.length, 0),
    totalDataRows,
  };
}

export function assertCustomersImportGroupsShape(
  groups: CustomersImportGroup[],
): CustomersImportRowError[] {
  const errors: CustomersImportRowError[] = [];

  for (const group of groups) {
    const rowNumber = group.sourceRowNumbers[0] || 0;
    if (!group.clave || !group.sender.firstName || !group.sender.lastName || !group.sender.phone) {
      errors.push({
        rowNumber,
        message: `Grupo ${group.clave || "(sin clave)"} incompleto en el servidor.`,
      });
      continue;
    }

    for (const recipient of group.recipients) {
      if (!recipient.firstName || !recipient.lastName || !recipient.phone || !recipient.country) {
        errors.push({
          rowNumber: recipient.sourceRowNumber || rowNumber,
          message: `Destinatario incompleto en el grupo ${group.clave}.`,
        });
      }
    }
  }

  return errors;
}
