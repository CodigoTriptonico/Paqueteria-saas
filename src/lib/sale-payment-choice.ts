import {
  isPaymentMethod,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";

export type SalePaymentChoice = PaymentMethod | "pending";

export const SALE_PAYMENT_UNSET = "unset" as const;

export type SalePaymentSelection = SalePaymentChoice | typeof SALE_PAYMENT_UNSET;


export function isSalePaymentChoice(value: unknown): value is SalePaymentChoice {
  return value === "pending" || isPaymentMethod(value);
}

export function isSalePaymentUnset(
  value: SalePaymentSelection,
): value is typeof SALE_PAYMENT_UNSET {
  return value === SALE_PAYMENT_UNSET;
}

export function isResolvedSalePaymentChoice(
  value: SalePaymentSelection,
): value is SalePaymentChoice {
  return isSalePaymentChoice(value);
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
