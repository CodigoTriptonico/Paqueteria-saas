const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Turns a zero-based box position into the suffix used on its invoice.
 * A, B, ... Z, AA, AB ... keeps the printed number short and unambiguous.
 */
export function invoiceBoxSuffix(index: number) {
  let value = Math.max(0, Math.floor(index));
  let suffix = "";

  do {
    suffix = `${ALPHABET[value % ALPHABET.length]}${suffix}`;
    value = Math.floor(value / ALPHABET.length) - 1;
  } while (value >= 0);

  return suffix;
}

/** The invoice shown on one physical box, linked to its sale invoice. */
export function invoiceBoxCode(invoiceCode: string, index: number) {
  const parentInvoiceCode = invoiceCode.trim();

  if (!parentInvoiceCode) {
    throw new Error("La factura principal es obligatoria para numerar una caja.");
  }

  return `${parentInvoiceCode}/${invoiceBoxSuffix(index)}`;
}

export function invoiceBoxCodes(invoiceCode: string, count: number) {
  return Array.from(
    { length: Math.max(0, Math.floor(count)) },
    (_, index) => invoiceBoxCode(invoiceCode, index),
  );
}

/**
 * Extra printed sheets for multi-box sales only.
 * A single box already has the parent invoice; printing /A is a duplicate paper.
 * Logistics still stores one child invoice_code per package.
 */
export function printableBoxInvoiceCodes(invoiceCode: string, count: number) {
  const boxCount = Math.max(0, Math.floor(count));
  if (boxCount <= 1) {
    return [];
  }
  return invoiceBoxCodes(invoiceCode, boxCount);
}
