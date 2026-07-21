import { formatMoneyValue } from "@/lib/logistics-fees";
import type { LogisticsTaskType } from "@/lib/logistics-routing";

export type ConductorPaymentChoice = "expected" | "custom" | "none";
export type ConductorPaymentOutcome = "collected" | "not_collected" | "not_applicable";

function money(value: number) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
}

export function isConductorPaymentChoice(value: unknown): value is ConductorPaymentChoice {
  return value === "expected" || value === "custom" || value === "none";
}

export function conductorExpectedDepositCollection(input: {
  result: "completed" | "failed";
  taskType: LogisticsTaskType;
  depositDue: number;
  balanceDue: number;
}) {
  if (input.result !== "completed" || input.taskType !== "deliver_empty_box") {
    return 0;
  }

  return Math.min(money(input.depositDue), money(input.balanceDue));
}

export function conductorPaymentChoiceError(input: {
  choice: ConductorPaymentChoice | null;
  expectedAmount: number;
  customAmount: number;
}) {
  if (!input.choice) {
    return "Indica si recibiste el depósito.";
  }

  if (input.choice === "custom" && money(input.customAmount) <= 0) {
    return "Indica un monto recibido válido.";
  }

  return null;
}

export function resolveConductorPaymentAmount(input: {
  choice: ConductorPaymentChoice;
  expectedAmount: number;
  customAmount: number;
}) {
  if (input.choice === "none") {
    return { amount: 0, outcome: "not_collected" as const };
  }

  return {
    amount: input.choice === "expected" ? money(input.expectedAmount) : money(input.customAmount),
    outcome: "collected" as const,
  };
}

export function settleConductorPayment(input: {
  quotedTotal: number;
  alreadyPaid: number;
  receivedAmount: number;
}) {
  const quotedTotal = money(input.quotedTotal);
  const alreadyPaid = money(input.alreadyPaid);
  const receivedAmount = money(input.receivedAmount);
  const paid = money(alreadyPaid + receivedAmount);
  const adjustedQuotedTotal = Math.max(quotedTotal, paid);
  const balanceDue = money(adjustedQuotedTotal - paid);

  return {
    paid,
    balanceDue,
    adjustedQuotedTotal,
    totalAdjusted: adjustedQuotedTotal > quotedTotal,
    totalAdjustment: money(adjustedQuotedTotal - quotedTotal),
    isPaidInFull: balanceDue === 0,
  };
}

export function conductorCollectionAuditDescription(input: {
  expectedAmount: number;
  receivedAmount: number;
  outcome: Extract<ConductorPaymentOutcome, "collected" | "not_collected">;
}) {
  const expectedAmount = formatMoneyValue(money(input.expectedAmount));

  if (input.outcome === "not_collected") {
    return `No recibió ${expectedAmount}; el cobro queda pendiente.`;
  }

  const receivedAmount = formatMoneyValue(money(input.receivedAmount));
  return input.expectedAmount === input.receivedAmount
    ? `Recibió ${receivedAmount}.`
    : `Esperado ${expectedAmount}; recibió ${receivedAmount}.`;
}
