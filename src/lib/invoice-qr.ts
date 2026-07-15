export function invoiceQrValue(invoiceNumber: string, origin?: string) {
  const trimmed = invoiceNumber.trim();
  if (!trimmed) {
    return "";
  }

  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (base) {
    return `${base}/rastrear?codigo=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
