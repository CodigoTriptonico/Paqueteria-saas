import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";

export type SaleDepositChargeMode = "deposit" | "full";

export function resolveSaleDepositChargeAmount(input: {
  mode: SaleDepositChargeMode;
  depositDraft: string;
  minimumDeposit: string | number;
  quotedTotal: string | number;
}): number {
  const quotedTotal = Math.max(parseMoneyValue(String(input.quotedTotal)), 0);
  if (quotedTotal <= 0) {
    return 0;
  }

  if (input.mode === "full") {
    return quotedTotal;
  }

  const minimumDeposit = Math.min(parseMoneyValue(String(input.minimumDeposit)), quotedTotal);
  const draft = input.depositDraft.trim();
  if (!draft) {
    return minimumDeposit;
  }

  return Math.min(Math.max(parseMoneyValue(draft), 0), quotedTotal);
}

export function saleDepositChargeAmountDigits(input: {
  mode: SaleDepositChargeMode;
  depositDraft: string;
  minimumDeposit: string | number;
  quotedTotal: string | number;
}): string {
  const amount = resolveSaleDepositChargeAmount(input);
  return formatMoneyValue(amount).replace(/^\$/, "");
}

export function defaultSaleDepositDraft(
  minimumDeposit: string | number,
  quotedTotal: string | number,
): string {
  const quoted = Math.max(parseMoneyValue(String(quotedTotal)), 0);
  const minimum = Math.min(parseMoneyValue(String(minimumDeposit)), quoted);
  return formatMoneyValue(minimum).replace(/^\$/, "");
}
