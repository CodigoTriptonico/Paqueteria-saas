export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "check", label: "Cheque" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "paypal", label: "PayPal" },
  { value: "cash_app", label: "Cash App" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "deposit", label: "Deposito bancario" },
  { value: "other", label: "Otro" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "cash";

const PAYMENT_METHOD_LABELS = new Map<PaymentMethod, string>(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label]),
);

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    PAYMENT_METHOD_OPTIONS.some((option) => option.value === value)
  );
}

export function paymentMethodLabel(method: PaymentMethod) {
  return PAYMENT_METHOD_LABELS.get(method) || "Otro";
}
