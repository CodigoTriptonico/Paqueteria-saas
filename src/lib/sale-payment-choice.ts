import {
  isPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";

export type SalePaymentChoice = PaymentMethod | "pending";

export const SALE_PAYMENT_CHOICE_OPTIONS: Array<{ value: SalePaymentChoice; label: string }> = [
  { value: "pending", label: "Pendiente" },
  ...PAYMENT_METHOD_OPTIONS,
];

export function isSalePaymentChoice(value: unknown): value is SalePaymentChoice {
  return value === "pending" || isPaymentMethod(value);
}

export function salePaymentChoiceLabel(choice: SalePaymentChoice) {
  if (choice === "pending") {
    return "Pendiente";
  }

  return paymentMethodLabel(choice);
}

export function resolveSalePaymentInput(input: {
  choice: SalePaymentChoice;
  payNow: string;
  paymentNote?: string;
}) {
  if (input.choice === "pending") {
    return {
      paid: "$0",
      paymentMethod: undefined as PaymentMethod | undefined,
      paymentNote: "",
    };
  }

  return {
    paid: input.payNow,
    paymentMethod: input.choice,
    paymentNote: input.paymentNote?.trim() || "",
  };
}
