import {
  formatMoneyValue,
  parseMoneyValue,
  type LogisticsFeeConfig,
} from "@/lib/logistics-fees";
import {
  choosePromotionQuote,
  quoteCombosForCart,
  quotePromotionsForBox,
  type ComboCartLine,
  type PricingPromotionConfig,
  type PromotionQuote,
} from "@/lib/pricing-promotions";

export type LogisticsFeeMode = "per_trip" | "per_box";

export type InvoiceBillingConfig = LogisticsFeeConfig & {
  minimumDeposit: string;
  logisticsFeeMode: LogisticsFeeMode;
};

export type InvoiceBillingCartLine = ComboCartLine & {
  label: string;
  unitCost?: string;
  carrier?: string;
  time?: string;
};

export const defaultInvoiceBillingConfig: InvoiceBillingConfig = {
  emptyBoxDeliveryFee: "$0",
  fullBoxPickupFee: "$0",
  minimumDeposit: "$20",
  logisticsFeeMode: "per_trip",
};

export type InvoiceBillingSnapshot = {
  boxCount: number;
  boxUnitPrice: string;
  cartLines: InvoiceBillingCartLine[];
  boxSubtotalBeforeDiscount: string;
  boxSubtotal: string;
  promotionDiscount: string;
  promotion: PromotionQuote | null;
  promotionCandidates: PromotionQuote[];
  promotionSelectionRequired: boolean;
  logisticsFeeMode: LogisticsFeeMode;
  emptyBoxDelivery: string;
  fullBoxPickup: string;
  logisticsSubtotal: string;
  quotedTotal: string;
  minimumDeposit: string;
  payNow: string;
  balanceDue: string;
};

export function computeInvoiceBilling(input: {
  boxCount?: number;
  boxUnitPrice: string;
  emptyBoxDriver: boolean;
  fullBoxDriver: boolean;
  fees: InvoiceBillingConfig;
  payNow?: number;
  catalogKey?: string;
  cartLines?: InvoiceBillingCartLine[];
  promotions?: PricingPromotionConfig[];
  selectedPromotionId?: string;
}): InvoiceBillingSnapshot {
  const fallbackCartLine: InvoiceBillingCartLine = {
    label: "Caja",
    catalogKey: input.catalogKey?.trim() || "",
    quantity: Math.max(input.boxCount ?? 1, 1),
    unitPrice: input.boxUnitPrice,
  };
  const cartLines = (input.cartLines?.length ? input.cartLines : [fallbackCartLine])
    .map((line) => ({
      ...line,
      quantity: Math.max(Math.floor(line.quantity) || 1, 1),
      unitPrice: line.unitPrice || "$0",
    }));
  const boxCount = cartLines.reduce((sum, line) => sum + line.quantity, 0) || 1;
  const boxUnitAmount = parseMoneyValue(cartLines[0]?.unitPrice || input.boxUnitPrice);
  const boxSubtotalBeforeDiscount = cartLines.reduce(
    (sum, line) => sum + parseMoneyValue(line.unitPrice) * line.quantity,
    0,
  );
  const promotionCandidates = input.cartLines?.length
    ? quoteCombosForCart({
        cart: cartLines,
        promotions: input.promotions,
      })
    : quotePromotionsForBox({
        boxCount,
        boxUnitPrice: input.boxUnitPrice,
        catalogKey: input.catalogKey,
        promotions: input.promotions,
      });
  const promotion = choosePromotionQuote({
    candidates: promotionCandidates,
    selectedPromotionId: input.selectedPromotionId,
  });
  const promotionDiscount = promotion ? parseMoneyValue(promotion.discountTotal) : 0;
  const boxSubtotal = Math.max(boxSubtotalBeforeDiscount - promotionDiscount, 0);
  const mode = input.fees.logisticsFeeMode;
  const emptyBoxDelivery = 0;
  const fullBoxPickup = 0;
  const logisticsSubtotal = emptyBoxDelivery + fullBoxPickup;
  const quotedTotal = boxSubtotal + logisticsSubtotal;

  const minimumDeposit = Math.min(parseMoneyValue(input.fees.minimumDeposit), quotedTotal);
  const payNow =
    input.payNow === undefined
      ? Math.min(minimumDeposit, quotedTotal)
      : Math.min(Math.max(input.payNow, 0), quotedTotal);
  const balanceDue = Math.max(quotedTotal - payNow, 0);

  return {
    boxCount,
    boxUnitPrice: formatMoneyValue(boxUnitAmount),
    cartLines,
    boxSubtotalBeforeDiscount: formatMoneyValue(boxSubtotalBeforeDiscount),
    boxSubtotal: formatMoneyValue(boxSubtotal),
    promotionDiscount: formatMoneyValue(promotionDiscount),
    promotion,
    promotionCandidates,
    promotionSelectionRequired: promotionCandidates.length > 1 && !promotion,
    logisticsFeeMode: mode,
    emptyBoxDelivery: formatMoneyValue(emptyBoxDelivery),
    fullBoxPickup: formatMoneyValue(fullBoxPickup),
    logisticsSubtotal: formatMoneyValue(logisticsSubtotal),
    quotedTotal: formatMoneyValue(quotedTotal),
    minimumDeposit: formatMoneyValue(minimumDeposit),
    payNow: formatMoneyValue(payNow),
    balanceDue: formatMoneyValue(balanceDue),
  };
}

export function resolvePayNowFromDraft(draft: string, touched: boolean): number | undefined {
  if (!touched && !draft.trim()) {
    return undefined;
  }

  if (!draft.trim()) {
    return 0;
  }

  return parseMoneyValue(draft);
}

export function readBillingFromPlan(value: unknown): InvoiceBillingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const billing = (value as Record<string, unknown>).billing;
  if (!billing || typeof billing !== "object" || Array.isArray(billing)) {
    return null;
  }

  const row = billing as Record<string, unknown>;
  const quotedTotal = String(row.quotedTotal || "");
  const payNow = String(row.payNow || "");
  const balanceDue = String(row.balanceDue || "");

  if (!quotedTotal || !payNow) {
    return null;
  }

  return {
    boxCount: Number(row.boxCount) || 1,
    boxUnitPrice: String(row.boxUnitPrice || "$0"),
    cartLines: Array.isArray(row.cartLines)
      ? (row.cartLines as InvoiceBillingCartLine[])
      : [
          {
            label: "Caja",
            catalogKey: "",
            quantity: Number(row.boxCount) || 1,
            unitPrice: String(row.boxUnitPrice || "$0"),
          },
        ],
    boxSubtotalBeforeDiscount: String(row.boxSubtotalBeforeDiscount || row.boxSubtotal || "$0"),
    boxSubtotal: String(row.boxSubtotal || "$0"),
    promotionDiscount: String(row.promotionDiscount || "$0"),
    promotion: (row.promotion as PromotionQuote | null) || null,
    promotionCandidates: Array.isArray(row.promotionCandidates)
      ? (row.promotionCandidates as PromotionQuote[])
      : [],
    promotionSelectionRequired: Boolean(row.promotionSelectionRequired),
    logisticsFeeMode: row.logisticsFeeMode === "per_box" ? "per_box" : "per_trip",
    emptyBoxDelivery: String(row.emptyBoxDelivery || "$0"),
    fullBoxPickup: String(row.fullBoxPickup || "$0"),
    logisticsSubtotal: String(row.logisticsSubtotal || "$0"),
    quotedTotal,
    minimumDeposit: String(row.minimumDeposit || "$0"),
    payNow,
    balanceDue: balanceDue || formatMoneyValue(parseMoneyValue(quotedTotal) - parseMoneyValue(payNow)),
  };
}

export function saleFinishActionLabel(
  billing: Pick<InvoiceBillingSnapshot, "balanceDue"> | null,
  options?: { creating?: boolean },
) {
  const hasBalanceDue = billing ? parseMoneyValue(billing.balanceDue) > 0 : true;

  if (options?.creating) {
    return hasBalanceDue ? "Creando invoice..." : "Cerrando venta...";
  }

  return hasBalanceDue ? "Crear invoice" : "Cerrar venta";
}
