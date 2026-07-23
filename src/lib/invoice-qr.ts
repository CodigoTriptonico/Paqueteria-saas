export function invoiceQrValue(invoiceNumber: string, origin?: string, trackingToken?: string) {
  const trimmed = invoiceNumber.trim();
  if (!trimmed) {
    return "";
  }

  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (base) {
    const query = trackingToken
      ? `token=${encodeURIComponent(trackingToken)}`
      : `codigo=${encodeURIComponent(trimmed)}`;
    return `${base}/rastrear?${query}`;
  }

  return trimmed;
}
