import type { SaleRecipient } from "@/lib/customers/mappers";

const RECIPIENT_COLUMNS = [
  "NOMBRE_DESTINATARIO",
  "TELEFONO",
  "CORREO",
  "CALLE",
  "NUMERO",
  "COLONIA",
  "CIUDAD",
  "ESTADO",
  "CODIGO_POSTAL",
  "PAIS",
  "REFERENCIA",
] as const;

function cleanTsvCell(value: string | undefined) {
  return (value || "").replace(/[\t\r\n]+/g, " ").trim();
}

/**
 * Two TSV rows: headers first, recipient values second.
 * Scanners can paste the result directly into spreadsheet columns.
 */
export function recipientExcelQrValue(recipient: SaleRecipient) {
  const values = [
    [recipient.firstName, recipient.lastName].filter(Boolean).join(" "),
    recipient.phone,
    recipient.emails.find(Boolean) || recipient.email,
    recipient.street,
    recipient.houseNumber,
    recipient.neighborhood,
    recipient.city,
    recipient.state,
    recipient.postalCode,
    recipient.country,
    recipient.addressReference,
  ];

  return [
    RECIPIENT_COLUMNS.join("\t"),
    values.map((value) => cleanTsvCell(value)).join("\t"),
  ].join("\n");
}
