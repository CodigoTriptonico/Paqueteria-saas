import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";

export const ANY_PRODUCT = "*";

type ComboRuleMode = "reward" | "bundle_price";
export type ComboBenefitKind = "percent_off" | "fixed_unit_price" | "set_total";

export type ComboBuyLine = {
  id: string;
  catalogKey: string;
  quantity: number;
};

export type ComboGetLine = {
  id: string;
  catalogKey: string;
  quantity: number;
  kind: ComboBenefitKind;
  percent?: number;
  amount?: string;
  target: "same_purchase" | "next_unit";
};

export type ComboRule = {
  mode: ComboRuleMode;
  buy: ComboBuyLine[];
  get: ComboGetLine[];
  bundlePrice?: string;
  repeat: boolean;
};

export type PricingPromotionConfig = {
  id: string;
  countryName: string;
  name: string;
  active: boolean;
  rule: ComboRule;
  catalogKey: string;
  sortOrder: number;
};

export type ComboCartLine = {
  catalogKey: string;
  quantity: number;
  unitPrice: string;
};

export type PromotionQuote = {
  promotionId: string;
  name: string;
  description: string;
  subtotalBeforeDiscount: string;
  subtotalAfterDiscount: string;
  discountTotal: string;
};

type LegacyPromotionRow = {
  catalog_key: string;
  promotion_type: string;
  bundle_quantity: number | null;
  bundle_price: string | null;
  paid_quantity: number | null;
  discounted_quantity: number | null;
  discount_percent: number | string | null;
};

function safeCount(value: number, fallback = 1) {
  return Math.max(Number.isFinite(value) ? Math.floor(value) : fallback, 1);
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

export function createComboLineId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dedupeComboLineIds<T extends { id: string }>(lines: T[]): T[] {
  const seen = new Set<string>();

  return lines.map((line) => {
    const currentId = line.id.trim();

    if (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      return line;
    }

    const nextId = createComboLineId();
    seen.add(nextId);
    return { ...line, id: nextId };
  });
}

export function ensureComboRuleLineIds(rule: ComboRule): ComboRule {
  return {
    ...rule,
    buy: dedupeComboLineIds(rule.buy),
    get: dedupeComboLineIds(rule.get),
  };
}

function createBlankComboRule(): ComboRule {
  return {
    mode: "reward",
    buy: [],
    get: [],
    repeat: true,
  };
}

export function createBlankPromotion(input: {
  id: string;
  countryName: string;
  sortOrder?: number;
}): PricingPromotionConfig {
  const rule = createBlankComboRule();

  return {
    id: input.id,
    countryName: input.countryName,
    name: "",
    active: true,
    rule,
    catalogKey: "",
    sortOrder: input.sortOrder ?? 0,
  };
}

export function normalizeComboRule(value: unknown): ComboRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createBlankComboRule();
  }

  const row = value as Record<string, unknown>;
  const buy = Array.isArray(row.buy)
    ? row.buy
        .map((line) => {
          if (!line || typeof line !== "object" || Array.isArray(line)) {
            return null;
          }

          const entry = line as Record<string, unknown>;

          return {
            id: String(entry.id || createComboLineId()),
            catalogKey: String(entry.catalogKey || ""),
            quantity: safeCount(Number(entry.quantity), 1),
          } satisfies ComboBuyLine;
        })
        .filter((line): line is ComboBuyLine => Boolean(line))
    : [];

  const get: ComboGetLine[] = Array.isArray(row.get)
    ? row.get
        .map((line): ComboGetLine | null => {
          if (!line || typeof line !== "object" || Array.isArray(line)) {
            return null;
          }

          const entry = line as Record<string, unknown>;
          const kind =
            entry.kind === "fixed_unit_price" || entry.kind === "set_total"
              ? entry.kind
              : "percent_off";

          return {
            id: String(entry.id || createComboLineId()),
            catalogKey: String(entry.catalogKey || ""),
            quantity: safeCount(Number(entry.quantity), 1),
            kind,
            percent: safePercent(Number(entry.percent)),
            amount: typeof entry.amount === "string" ? entry.amount : "",
            target: entry.target === "next_unit" ? "next_unit" : "same_purchase",
          } satisfies ComboGetLine;
        })
        .filter((line): line is ComboGetLine => Boolean(line))
    : [];

  const normalizedBuy = buy;
  const normalizedGet = get;
  const explicitMode: ComboRuleMode | null =
    row.mode === "bundle_price" || row.mode === "reward" ? row.mode : null;
  const legacyBundleLine: ComboGetLine | undefined =
    explicitMode === null
      ? normalizedGet.find((line) => line.kind === "set_total")
      : undefined;

  if (explicitMode === "bundle_price" || legacyBundleLine) {
    const bundleLines =
      legacyBundleLine && normalizedBuy.length === 1 && normalizedGet.length === 1
        ? normalizedBuy[0]?.catalogKey === legacyBundleLine.catalogKey &&
          normalizedBuy[0]?.quantity === legacyBundleLine.quantity
          ? normalizedBuy
          : [
              ...normalizedBuy,
              {
                id: legacyBundleLine.id,
                catalogKey: legacyBundleLine.catalogKey,
                quantity: legacyBundleLine.quantity,
              },
            ]
        : normalizedBuy;

    return ensureComboRuleLineIds({
      mode: "bundle_price",
      buy: bundleLines,
      get: explicitMode === "bundle_price" ? normalizedGet : [],
      bundlePrice:
        typeof row.bundlePrice === "string"
          ? row.bundlePrice
          : legacyBundleLine?.amount || "$0",
      repeat: row.repeat !== false,
    });
  }

  return ensureComboRuleLineIds({
    mode: "reward",
    buy: normalizedBuy,
    get: normalizedGet,
    repeat: row.repeat !== false,
  });
}

export function legacyPromotionToRule(row: LegacyPromotionRow): ComboRule {
  const catalogKey = row.catalog_key.trim();

  if (row.promotion_type === "bundle_price") {
    const quantity = safeCount(Number(row.bundle_quantity), 2);

    return {
      mode: "bundle_price",
      buy: [{ id: createComboLineId(), catalogKey, quantity }],
      get: [],
      bundlePrice: row.bundle_price || "$0",
      repeat: true,
    };
  }

  const paidQuantity = safeCount(Number(row.paid_quantity), 2);
  const discountedQuantity = safeCount(Number(row.discounted_quantity), 1);
  const discountPercent = safePercent(Number(row.discount_percent));

  return {
    mode: "reward",
    buy: [{ id: createComboLineId(), catalogKey, quantity: paidQuantity }],
    get: [
      {
        id: createComboLineId(),
        catalogKey,
        quantity: discountedQuantity,
        kind: "percent_off",
        percent: discountPercent,
        target: "next_unit",
      },
    ],
    repeat: true,
  };
}

export function promotionFromDbRow(input: {
  id: string;
  countryName: string;
  name: string;
  active: boolean;
  catalog_key: string;
  sort_order?: number;
  rule_json?: unknown;
  legacy?: LegacyPromotionRow;
}): PricingPromotionConfig {
  const rule = input.rule_json
    ? normalizeComboRule(input.rule_json)
    : input.legacy
      ? legacyPromotionToRule(input.legacy)
      : createBlankComboRule();

  return {
    id: input.id,
    countryName: input.countryName,
    name: input.name,
    active: input.active,
    rule,
    catalogKey: primaryCatalogKey(rule) || input.catalog_key.trim(),
    sortOrder: input.sort_order ?? 0,
  };
}

export function primaryCatalogKey(rule: ComboRule) {
  const specific = rule.buy.find((line) => line.catalogKey && line.catalogKey !== ANY_PRODUCT);

  if (specific) {
    return specific.catalogKey;
  }

  const rewardSpecific = rule.get.find(
    (line) => line.catalogKey && line.catalogKey !== ANY_PRODUCT,
  );

  return rewardSpecific?.catalogKey || "";
}

export function promotionMatchesCartCatalog(
  promotion: PricingPromotionConfig,
  catalogKeys: string[],
) {
  const normalized = new Set(catalogKeys.map(normalizeKey).filter(Boolean));

  if (!normalized.size) {
    return false;
  }

  const referenced = new Set<string>();

  for (const line of [...promotion.rule.buy, ...promotion.rule.get]) {
    if (!line.catalogKey || line.catalogKey === ANY_PRODUCT) {
      return true;
    }

    referenced.add(normalizeKey(line.catalogKey));
  }

  for (const key of normalized) {
    if (referenced.has(key)) {
      return true;
    }
  }

  return referenced.size === 0;
}

function productLabel(catalogKey: string, labels?: Record<string, string>) {
  if (catalogKey === ANY_PRODUCT) {
    return "cualquier producto";
  }

  return labels?.[catalogKey] || catalogKey;
}

function describeBuyLine(line: ComboBuyLine, labels?: Record<string, string>) {
  return `${line.quantity}× ${productLabel(line.catalogKey, labels)}`;
}

function repeatSuffix(repeat: boolean) {
  return repeat ? " · varias veces" : " · una vez por venta";
}

function buyIncludesProduct(buy: ComboBuyLine[], catalogKey: string) {
  const key = normalizeKey(catalogKey);

  return buy.some((line) => normalizeKey(line.catalogKey) === key);
}

function uniqueBuyProductCount(buy: ComboBuyLine[]) {
  return new Set(buy.map((line) => normalizeKey(line.catalogKey))).size;
}

export function isBundlePromotionEligible(rule: Pick<ComboRule, "buy">) {
  return uniqueBuyProductCount(rule.buy) >= 2;
}

export function coerceSingleProductBundleRule(rule: ComboRule): ComboRule {
  if (rule.mode !== "bundle_price" || isBundlePromotionEligible(rule)) {
    return rule;
  }

  const buy = rule.buy.filter((line) => line.catalogKey.trim() && line.quantity > 0);
  const catalogKey = buy[0]?.catalogKey.trim() ?? "";

  if (!catalogKey) {
    return {
      mode: "reward",
      buy: rule.buy,
      get: [],
      repeat: rule.repeat,
      bundlePrice: undefined,
    };
  }

  const quantity =
    buy.find((line) => normalizeKey(line.catalogKey) === normalizeKey(catalogKey))?.quantity ??
    1;

  return {
    mode: "reward",
    buy: rule.buy,
    repeat: rule.repeat,
    bundlePrice: undefined,
    get: [
      {
        id: createComboLineId(),
        catalogKey,
        quantity,
        kind: "set_total",
        amount: rule.bundlePrice || "",
        target: "same_purchase",
      },
    ],
  };
}

function describeRewardBenefit(
  line: ComboGetLine,
  buy: ComboBuyLine[],
  labels?: Record<string, string>,
) {
  const qty = line.quantity;
  const label = productLabel(line.catalogKey, labels);
  const sameProduct = buyIncludesProduct(buy, line.catalogKey);
  const singleBuyProduct = uniqueBuyProductCount(buy) === 1;
  const nextUnit = line.target === "next_unit";
  const nextScope = nextUnit ? " (siguiente unidad)" : "";

  if (line.kind === "set_total") {
    return `${qty}× ${label} por ${line.amount || "$0"}${nextScope}`;
  }

  if (line.kind === "fixed_unit_price") {
    if (sameProduct && qty === 1 && !nextUnit && singleBuyProduct) {
      return `precio ${line.amount || "$0"} en 1 unidad`;
    }

    return `${qty}× ${label} a ${line.amount || "$0"}${nextScope}`;
  }

  const percent = safePercent(Number(line.percent));

  if (percent >= 100) {
    if (sameProduct && singleBuyProduct) {
      return qty === 1 ? "1 gratis" : `${qty} gratis`;
    }

    if (sameProduct) {
      return qty === 1 ? `1× ${label} gratis` : `${qty}× ${label} gratis`;
    }

    return `regalo ${qty}× ${label}${nextScope}`;
  }

  if (sameProduct && qty === 1 && !nextUnit) {
    if (singleBuyProduct) {
      return `${percent}% en 1 unidad`;
    }

    return `${percent}% en 1× ${label}`;
  }

  return `${percent}% en ${qty}× ${label}${nextScope}`;
}

export function describeComboRule(rule: ComboRule, labels?: Record<string, string>) {
  const buyLines = rule.buy.filter((line) => line.catalogKey && line.quantity > 0);

  if (rule.mode === "bundle_price") {
    if (!buyLines.length) {
      return "Regla incompleta";
    }

    const buy = buyLines.map((line) => describeBuyLine(line, labels));

    return `${buy.join(" + ")} por ${rule.bundlePrice || "$0"}${repeatSuffix(rule.repeat)}`;
  }

  const getLines = rule.get.filter((line) => line.catalogKey && line.quantity > 0);

  if (!buyLines.length || !getLines.length) {
    return "Regla incompleta";
  }

  const buy = buyLines.map((line) => describeBuyLine(line, labels)).join(" + ");
  const benefits = getLines
    .map((line) => describeRewardBenefit(line, buyLines, labels))
    .join(" · ");

  return `Compra ${buy} → ${benefits}${repeatSuffix(rule.repeat)}`;
}

export function describeComboRuleShort(rule: ComboRule, labels?: Record<string, string>) {
  const text = describeComboRule(rule, labels);

  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

function cloneQtyMap(cart: ComboCartLine[]) {
  const map = new Map<string, number>();

  for (const line of cart) {
    const key = normalizeKey(line.catalogKey);

    if (!key || line.quantity <= 0) {
      continue;
    }

    map.set(key, (map.get(key) || 0) + line.quantity);
  }

  return map;
}

function unitPriceForKey(cart: ComboCartLine[], catalogKey: string) {
  const key = normalizeKey(catalogKey);
  const line = cart.find((entry) => normalizeKey(entry.catalogKey) === key);

  return line ? parseMoneyValue(line.unitPrice) : 0;
}

function totalQty(map: Map<string, number>) {
  let total = 0;

  for (const qty of map.values()) {
    total += qty;
  }

  return total;
}

function satisfiesBuy(map: Map<string, number>, buy: ComboBuyLine[]) {
  const requiredByKey = new Map<string, number>();

  for (const line of buy) {
    if (!line.catalogKey || line.quantity <= 0) {
      return false;
    }

    const key = line.catalogKey === ANY_PRODUCT ? ANY_PRODUCT : normalizeKey(line.catalogKey);
    requiredByKey.set(key, (requiredByKey.get(key) || 0) + line.quantity);
  }

  for (const [key, quantity] of requiredByKey.entries()) {
    if (key === ANY_PRODUCT) {
      if (totalQty(map) < quantity) {
        return false;
      }

      continue;
    }

    if ((map.get(key) || 0) < quantity) {
      return false;
    }
  }

  return buy.length > 0;
}

function consumeFromMap(map: Map<string, number>, catalogKey: string, quantity: number) {
  let remaining = quantity;

  if (catalogKey === ANY_PRODUCT) {
    const keys = [...map.keys()].sort(
      (left, right) => (map.get(right) || 0) - (map.get(left) || 0),
    );

    for (const key of keys) {
      if (remaining <= 0) {
        break;
      }

      const available = map.get(key) || 0;
      const used = Math.min(available, remaining);
      const next = available - used;

      if (next > 0) {
        map.set(key, next);
      } else {
        map.delete(key);
      }

      remaining -= used;
    }

    return;
  }

  const key = normalizeKey(catalogKey);
  const available = map.get(key) || 0;
  const next = Math.max(available - quantity, 0);

  if (next > 0) {
    map.set(key, next);
  } else {
    map.delete(key);
  }
}

function consumeBuy(map: Map<string, number>, buy: ComboBuyLine[]) {
  for (const line of buy) {
    consumeFromMap(map, line.catalogKey, line.quantity);
  }
}

function availableUnits(
  remaining: Map<string, number>,
  catalogKey: string,
) {
  if (catalogKey === ANY_PRODUCT) {
    return totalQty(remaining);
  }

  return remaining.get(normalizeKey(catalogKey)) || 0;
}

function unitPriceForAnyFromRemaining(
  remaining: Map<string, number>,
  cart: ComboCartLine[],
) {
  for (const [key, qty] of remaining.entries()) {
    if (qty <= 0) {
      continue;
    }

    const price = unitPriceForKey(cart, key);

    if (price > 0) {
      return price;
    }
  }

  return 0;
}

function normalTotalForLine(input: {
  line: ComboBuyLine;
  cart: ComboCartLine[];
  remaining: Map<string, number>;
}) {
  const { line, cart, remaining } = input;
  const units = availableUnits(remaining, line.catalogKey);
  const appliedUnits = Math.min(safeCount(line.quantity, 1), units);

  if (appliedUnits <= 0) {
    return 0;
  }

  const unitPrice =
    line.catalogKey === ANY_PRODUCT
      ? unitPriceForAnyFromRemaining(remaining, cart)
      : unitPriceForKey(cart, line.catalogKey);

  return unitPrice * appliedUnits;
}

function discountForGetLine(input: {
  line: ComboGetLine;
  cart: ComboCartLine[];
  remaining: Map<string, number>;
}) {
  const { line, cart, remaining } = input;
  const limit = safeCount(line.quantity, 1);
  const units = availableUnits(remaining, line.catalogKey);

  if (units <= 0) {
    return { discount: 0, appliedUnits: 0 };
  }

  const appliedUnits = Math.min(limit, units);
  const unitPrice =
    line.catalogKey === ANY_PRODUCT
      ? unitPriceForAnyFromRemaining(remaining, cart)
      : unitPriceForKey(cart, line.catalogKey);

  if (unitPrice <= 0) {
    return { discount: 0, appliedUnits: 0 };
  }

  if (line.kind === "set_total") {
    const bundleTotal = parseMoneyValue(line.amount || "$0");
    const normal = unitPrice * appliedUnits;

    return {
      discount: Math.max(normal - bundleTotal, 0),
      appliedUnits,
    };
  }

  if (line.kind === "fixed_unit_price") {
    const target = parseMoneyValue(line.amount || "$0");

    return {
      discount: Math.max((unitPrice - target) * appliedUnits, 0),
      appliedUnits,
    };
  }

  const percent = safePercent(Number(line.percent));

  return {
    discount: unitPrice * appliedUnits * (percent / 100),
    appliedUnits,
  };
}

function applyGetBenefits(input: {
  cart: ComboCartLine[];
  remaining: Map<string, number>;
  get: ComboGetLine[];
}) {
  let discount = 0;

  for (const line of input.get) {
    const result = discountForGetLine({
      line,
      cart: input.cart,
      remaining: input.remaining,
    });

    discount += result.discount;

    if (result.appliedUnits > 0) {
      consumeFromMap(input.remaining, line.catalogKey, result.appliedUnits);
    }
  }

  return discount;
}

function evaluateBundleDiscount(input: {
  cart: ComboCartLine[];
  rule: ComboRule;
}) {
  const working = cloneQtyMap(input.cart);
  const bundlePrice = parseMoneyValue(input.rule.bundlePrice || "$0");
  let discount = 0;
  let guard = 0;

  while (satisfiesBuy(working, input.rule.buy)) {
    const normal = input.rule.buy.reduce(
      (sum, line) =>
        sum +
        normalTotalForLine({
          line,
          cart: input.cart,
          remaining: working,
        }),
      0,
    );

    discount += Math.max(normal - bundlePrice, 0);

    for (const line of input.rule.buy) {
      consumeFromMap(working, line.catalogKey, line.quantity);
    }

    guard += 1;

    if (!input.rule.repeat || guard > 99) {
      break;
    }
  }

  return discount;
}

export function evaluateComboDiscount(input: {
  cart: ComboCartLine[];
  rule: ComboRule;
}) {
  if (input.rule.mode === "bundle_price") {
    return evaluateBundleDiscount(input);
  }

  const working = cloneQtyMap(input.cart);
  let discount = 0;
  let guard = 0;

  while (satisfiesBuy(working, input.rule.buy)) {
    consumeBuy(working, input.rule.buy);
    discount += applyGetBenefits({
      cart: input.cart,
      remaining: working,
      get: input.rule.get,
    });
    guard += 1;

    if (!input.rule.repeat || guard > 99) {
      break;
    }
  }

  return discount;
}

export function quoteCombosForCart(input: {
  cart: ComboCartLine[];
  promotions?: PricingPromotionConfig[];
}) {
  const subtotal = input.cart.reduce(
    (sum, line) => sum + parseMoneyValue(line.unitPrice) * Math.max(line.quantity, 0),
    0,
  );

  if (subtotal <= 0) {
    return [] as PromotionQuote[];
  }

  const catalogKeys = input.cart.map((line) => line.catalogKey);

  return (input.promotions || [])
    .filter((promotion) => promotion.active)
    .filter((promotion) => promotionMatchesCartCatalog(promotion, catalogKeys))
    .map((promotion) => {
      const discount = evaluateComboDiscount({
        cart: input.cart,
        rule: promotion.rule,
      });

      if (discount <= 0) {
        return null;
      }

      return {
        promotionId: promotion.id,
        name: promotion.name,
        description: describeComboRuleShort(promotion.rule),
        subtotalBeforeDiscount: formatMoneyValue(subtotal),
        subtotalAfterDiscount: formatMoneyValue(Math.max(subtotal - discount, 0)),
        discountTotal: formatMoneyValue(discount),
      } satisfies PromotionQuote;
    })
    .filter((quote): quote is PromotionQuote => Boolean(quote))
    .sort(
      (left, right) =>
        parseMoneyValue(right.discountTotal) - parseMoneyValue(left.discountTotal),
    );
}

export function quotePromotionsForBox(input: {
  boxCount: number;
  boxUnitPrice: string;
  catalogKey?: string;
  promotions?: PricingPromotionConfig[];
}) {
  const boxCount = safeCount(input.boxCount, 1);
  const catalogKey = input.catalogKey?.trim() || "";

  if (!catalogKey) {
    return [] as PromotionQuote[];
  }

  return quoteCombosForCart({
    cart: [{ catalogKey, quantity: boxCount, unitPrice: input.boxUnitPrice }],
    promotions: input.promotions,
  });
}

export function choosePromotionQuote(input: {
  candidates: PromotionQuote[];
  selectedPromotionId?: string;
}) {
  if (input.candidates.length === 1) {
    return input.candidates[0] || null;
  }

  if (!input.selectedPromotionId) {
    return null;
  }

  return (
    input.candidates.find((quote) => quote.promotionId === input.selectedPromotionId) || null
  );
}

function isGetLineValid(line: ComboGetLine) {
  if (!line.catalogKey.trim() || line.quantity <= 0) {
    return false;
  }

  if (line.kind === "percent_off") {
    return safePercent(Number(line.percent)) > 0;
  }

  return parseMoneyValue(line.amount || "$0") > 0;
}

export function isPromotionRuleValid(rule: ComboRule) {
  const buyValid = rule.buy.some(
    (line) => line.catalogKey.trim() && line.quantity > 0,
  );

  if (rule.mode === "bundle_price") {
    return (
      buyValid &&
      isBundlePromotionEligible(rule) &&
      parseMoneyValue(rule.bundlePrice || "$0") > 0
    );
  }

  return buyValid && rule.get.some(isGetLineValid);
}
