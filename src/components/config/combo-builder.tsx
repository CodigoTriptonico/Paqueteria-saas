"use client";

import { Gift, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { inputClass, pickerShellClass } from "@/components/ui-blocks";
import {
  ANY_PRODUCT,
  coerceSingleProductBundleRule,
  createComboLineId,
  describeComboRule,
  ensureComboRuleLineIds,
  isBundlePromotionEligible,
  type ComboBenefitKind,
  type ComboBuyLine,
  type ComboGetLine,
  type ComboRule,
} from "@/lib/combo-rules";
import { formatMoneyValue, moneyInputDisplayValue, parseMoneyValue } from "@/lib/logistics-fees";

export type ComboBuilderProduct = {
  catalogKey: string;
  label: string;
  price: string;
};

type ComboBuilderProps = {
  rule: ComboRule;
  onChange: (rule: ComboRule) => void;
  products: ComboBuilderProduct[];
};

type RuleIntent = "discount" | "free_gift" | "bundle_price";
type DiscountStyle = "percent" | "unit_price" | "set_total";

const productPickerMinWidth = "min-w-0";
const compactPickerShellClass = `${pickerShellClass} h-10 min-w-[8.5rem]`;
const productRowClass = "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2";
const productPickerClass = "w-full min-w-0";
const productPickerShellClass = `${pickerShellClass} h-10 w-full min-w-0`;
const iconButtonClass =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black transition";
const iconButtonDangerClass = `${iconButtonClass} bg-surface-inset text-slate-400 hover:border-rose-800/50 hover:text-rose-300`;
const sectionCardClass = "rounded-xl border border-black bg-surface-inset p-3.5";
const stepLabelClass =
  "text-[10px] font-black uppercase tracking-wide text-slate-300";
const helperTextClass = "text-xs font-bold text-slate-400";
const summaryTextClass =
  "rounded-lg border border-black bg-surface-card px-3 py-2 text-xs font-bold leading-relaxed text-slate-300";

function StepSection({
  step,
  label,
  children,
}: {
  step?: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className={sectionCardClass}>
      <div className="mb-2.5 flex items-center gap-2 border-b border-black pb-2">
        {step !== undefined ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-600/50 bg-emerald-400/15 text-[10px] font-black tabular-nums text-emerald-300">
            {step}
          </span>
        ) : null}
        <span className={stepLabelClass}>{label}</span>
      </div>
      {children}
    </section>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-1.5">{children}</div>;
}

function AddLineButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-600/40 bg-surface-inset px-3 text-xs font-black text-emerald-300 transition hover:border-emerald-500 hover:bg-surface-card-hover"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

const targetOptions = [
  { value: "same_purchase", label: "En esta compra", searchText: "misma compra" },
  { value: "next_unit", label: "Siguiente unidad", searchText: "siguiente" },
];

const intentOptions: {
  id: RuleIntent;
  title: string;
  icon: typeof Percent;
}[] = [
  { id: "discount", title: "Descuento", icon: Percent },
  { id: "free_gift", title: "Regalo", icon: Gift },
  { id: "bundle_price", title: "Paquete", icon: Tag },
];

function productPickerOptions(
  products: ComboBuilderProduct[],
  usedKeys: string[],
  currentKey: string,
  { includeAny = true }: { includeAny?: boolean } = {},
) {
  const used = new Set(
    usedKeys
      .map((key) => key.trim())
      .filter((key) => key && key !== currentKey.trim()),
  );

  const options = includeAny
    ? [
        {
          value: ANY_PRODUCT,
          label: "Cualquier producto",
          searchText: "cualquier tamaño",
          disabled: used.has(ANY_PRODUCT),
        },
      ]
    : [];

  return [
    ...options,
    ...products.map((product) => ({
      value: product.catalogKey,
      label: product.label,
      searchText: product.price,
      disabled: used.has(product.catalogKey),
    })),
  ];
}

function productPrice(products: ComboBuilderProduct[], catalogKey: string) {
  return products.find((product) => product.catalogKey === catalogKey)?.price || "$0";
}

function discountStyleFromLine(line: ComboGetLine | undefined): DiscountStyle {
  if (!line) {
    return "percent";
  }

  if (line.kind === "set_total") {
    return "set_total";
  }

  if (line.kind === "fixed_unit_price") {
    return "unit_price";
  }

  return "percent";
}

function sumBuyLines(buy: ComboBuyLine[], products: ComboBuilderProduct[]) {
  return buy
    .filter((line) => line.catalogKey.trim())
    .reduce(
      (sum, line) =>
        sum + parseMoneyValue(productPrice(products, line.catalogKey)) * line.quantity,
      0,
    );
}

function inferIntent(rule: ComboRule): RuleIntent | null {
  if (!rule.buy.some((line) => line.catalogKey.trim())) {
    return null;
  }

  if (rule.mode === "bundle_price") {
    return isBundlePromotionEligible(rule) ? "bundle_price" : null;
  }

  if (!rule.get.length) {
    return null;
  }

  const line = rule.get[0];

  if (line.kind === "percent_off" && (line.percent ?? 0) >= 100) {
    return "free_gift";
  }

  return "discount";
}

function buildDiscountRule(
  buy: ComboBuyLine[],
  catalogKey: string,
  style: DiscountStyle = "percent",
): ComboRule {
  const getLine: ComboGetLine = {
    id: createComboLineId(),
    catalogKey,
    quantity: 1,
    kind: "percent_off",
    percent: 20,
    target: "same_purchase",
  };

  if (style === "unit_price") {
    getLine.kind = "fixed_unit_price";
    getLine.amount = "";
    delete getLine.percent;
  } else if (style === "set_total") {
    getLine.kind = "set_total";
    getLine.amount = "";
    delete getLine.percent;
  }

  return {
    mode: "reward",
    buy,
    get: [getLine],
    repeat: true,
  };
}

function buildFreeGiftRule(buy: ComboBuyLine[], giftKey: string): ComboRule {
  return {
    mode: "reward",
    buy,
    get: [
      {
        id: createComboLineId(),
        catalogKey: giftKey,
        quantity: 1,
        kind: "percent_off",
        percent: 100,
        target: "same_purchase",
      },
    ],
    repeat: true,
  };
}

function uniqueBuyProducts(
  buy: ComboBuyLine[],
  productLabels: Record<string, string>,
) {
  const seen = new Set<string>();

  return buy
    .filter((line) => line.catalogKey.trim())
    .flatMap((line) => {
      if (seen.has(line.catalogKey)) {
        return [];
      }

      seen.add(line.catalogKey);

      return [
        {
          catalogKey: line.catalogKey,
          label: productLabels[line.catalogKey] || line.catalogKey,
        },
      ];
    });
}

function syncSingleProductDiscount(
  rule: ComboRule,
  productLabels: Record<string, string>,
): ComboRule {
  const unique = uniqueBuyProducts(rule.buy, productLabels);

  if (unique.length !== 1 || !rule.get.length) {
    return rule;
  }

  const primaryGet = rule.get[0];
  const isFreeGift =
    primaryGet.kind === "percent_off" && (primaryGet.percent ?? 0) >= 100;

  if (isFreeGift) {
    return rule;
  }

  const catalogKey = unique[0].catalogKey;

  if (primaryGet.catalogKey === catalogKey) {
    return rule;
  }

  return {
    ...rule,
    get: rule.get.map((line, index) =>
      index === 0 ? { ...line, catalogKey } : line,
    ),
  };
}

function buildBundleRule(buy: ComboBuyLine[], products: ComboBuilderProduct[]): ComboRule {
  return {
    mode: "bundle_price",
    buy,
    get: [],
    bundlePrice: formatMoneyValue(sumBuyLines(buy, products)),
    repeat: true,
  };
}

function isDiscountGetLine(line: ComboGetLine | undefined) {
  if (!line) {
    return false;
  }

  return !(line.kind === "percent_off" && (line.percent ?? 0) >= 100);
}

function pruneDiscountTargetForBuy(
  rule: ComboRule,
  labels: Record<string, string>,
  targetMode: "buy" | "other",
): ComboRule {
  if (rule.mode === "bundle_price" || !rule.get.length) {
    return rule;
  }

  const primaryGet = rule.get[0];

  if (!isDiscountGetLine(primaryGet)) {
    return rule;
  }

  const uniqueBuy = uniqueBuyProducts(rule.buy, labels);

  if (uniqueBuy.length <= 1 || targetMode === "other") {
    return rule;
  }

  const buyKeys = new Set(uniqueBuy.map((product) => product.catalogKey));

  if (primaryGet.catalogKey && !buyKeys.has(primaryGet.catalogKey)) {
    return {
      ...rule,
      get: rule.get.map((line, index) =>
        index === 0 ? { ...line, catalogKey: "" } : line,
      ),
    };
  }

  return rule;
}

function QtyInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      className={`${inputClass} h-10 w-14 shrink-0 px-2 text-center tabular-nums`}
      inputMode="numeric"
      value={value}
      onChange={(event) =>
        onChange(Math.max(Number.parseInt(event.target.value, 10) || 1, 1))
      }
      aria-label={ariaLabel}
    />
  );
}

function RepeatPills({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (repeat: boolean) => void;
}) {
  const options = [
    { value: false, label: "Una vez por venta" },
    { value: true, label: "Varias veces" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-10 rounded-lg border px-2 text-xs font-black transition ${
              active
                ? "border-emerald-500/50 bg-emerald-400/15 text-emerald-200"
                : "border-black bg-surface-card text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function IntentPills({
  value,
  onChange,
  bundleEligible,
}: {
  value: RuleIntent | null;
  onChange: (intent: RuleIntent) => void;
  bundleEligible: boolean;
}) {
  const visibleOptions = intentOptions.filter(
    (option) => option.id !== "bundle_price" || bundleEligible,
  );

  return (
    <div
      className={`grid gap-1.5 ${bundleEligible ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {visibleOptions.map((option) => {
        const Icon = option.icon;
        const active = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-black transition ${
              active
                ? "border-emerald-500/50 bg-emerald-400/15 text-emerald-200"
                : "border-black bg-surface-card text-slate-300 hover:bg-surface-card-hover hover:text-[#f8fafc]"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {option.title}
          </button>
        );
      })}
    </div>
  );
}

function buildDiscountHelperText(input: {
  target: "same_purchase" | "next_unit";
  discountStyle: DiscountStyle;
  fixedPriceNeedsUnitTotalChoice: boolean;
  buyConditionQty: number;
  rewardQty: number;
  singleBuyDiscount: boolean;
}) {
  const parts: string[] = [];

  if (input.target === "next_unit") {
    if (input.singleBuyDiscount && input.buyConditionQty > 0) {
      const condition =
        input.buyConditionQty === 1
          ? "1 unidad que cumple la condición"
          : `${input.buyConditionQty} unidades que cumplen la condición`;
      const reward =
        input.rewardQty === 1
          ? "la siguiente unidad"
          : `las siguientes ${input.rewardQty} unidades`;
      const minimum = input.buyConditionQty + input.rewardQty;

      parts.push(
        `Compra ${condition}; el descuento aplica a ${reward}, no a esas. Mínimo ${minimum} unidades en el carrito.`,
      );
    } else {
      parts.push(
        "El descuento aplica a la unidad bonificada siguiente, no a las que cumplen la condición de compra.",
      );
    }
  }

  if (input.discountStyle !== "percent" && input.fixedPriceNeedsUnitTotalChoice) {
    if (input.discountStyle === "unit_price") {
      parts.push("Precio c/u: cada unidad bonificada se cobra a ese monto.");
    } else {
      parts.push(
        input.target === "next_unit"
          ? "Precio total: el monto es solo por las unidades bonificadas, sin las de condición."
          : "Precio total: el monto cubre todas las unidades con descuento en esta compra.",
      );
    }
  }

  return parts.length ? parts.join(" ") : null;
}

export function ComboBuilder({ rule, onChange, products }: ComboBuilderProps) {
  const labels = useMemo(
    () => Object.fromEntries(products.map((product) => [product.catalogKey, product.label])),
    [products],
  );

  const inferredIntent = useMemo(() => inferIntent(rule), [rule]);
  const [pickedIntent, setPickedIntent] = useState<RuleIntent | null>(null);
  const [discountTargetMode, setDiscountTargetMode] = useState<"buy" | "other">("buy");
  const bundleEligible = isBundlePromotionEligible(rule);
  const intent = useMemo(() => {
    const candidate = pickedIntent ?? inferredIntent;

    if (candidate === "bundle_price" && !bundleEligible) {
      return inferredIntent && inferredIntent !== "bundle_price" ? inferredIntent : "discount";
    }

    return candidate;
  }, [pickedIntent, inferredIntent, bundleEligible]);
  const primaryGetLine = rule.get[0];

  const buyProducts = useMemo(
    () => uniqueBuyProducts(rule.buy, labels),
    [rule.buy, labels],
  );
  const singleBuyDiscount = buyProducts.length === 1;
  const singleBuyLineQty = useMemo(() => {
    if (!singleBuyDiscount) {
      return 0;
    }

    const catalogKey = buyProducts[0].catalogKey;

    return rule.buy
      .filter((line) => line.catalogKey === catalogKey)
      .reduce((sum, line) => sum + line.quantity, 0);
  }, [singleBuyDiscount, buyProducts, rule.buy]);
  const fixedPriceNeedsUnitTotalChoice = !singleBuyDiscount || singleBuyLineQty > 1;
  const discountStyleOptions = useMemo(() => {
    const options: { value: DiscountStyle; label: string }[] = [
      { value: "percent", label: "%" },
    ];

    if (fixedPriceNeedsUnitTotalChoice) {
      options.push(
        { value: "unit_price", label: "Precio c/u" },
        { value: "set_total", label: "Precio total" },
      );
    } else {
      options.push({ value: "set_total", label: "Precio" });
    }

    return options;
  }, [fixedPriceNeedsUnitTotalChoice]);
  const buyConditionQty = useMemo(
    () =>
      rule.buy
        .filter((line) => line.catalogKey.trim())
        .reduce((sum, line) => sum + line.quantity, 0),
    [rule.buy],
  );
  const buyFromDiscountOptions = useMemo(
    () =>
      buyProducts.map((product) => ({
        value: product.catalogKey,
        label: product.label,
        searchText: "compra",
      })),
    [buyProducts],
  );
  const catalogDiscountOptions = useMemo(() => {
    const buyKeys = new Set(buyProducts.map((product) => product.catalogKey));

    return products
      .filter((product) => !buyKeys.has(product.catalogKey))
      .map((product) => ({
        value: product.catalogKey,
        label: product.label,
        searchText: product.price,
      }));
  }, [buyProducts, products]);

  const isBundle = rule.mode === "bundle_price";
  const hasBuyLines = rule.buy.length > 0;
  const hasBuyProducts = rule.buy.some((line) => line.catalogKey.trim());
  const discountStyle = discountStyleFromLine(primaryGetLine);
  const discountHelperText = useMemo(() => {
    if (intent !== "discount" || !primaryGetLine) {
      return null;
    }

    return buildDiscountHelperText({
      target: primaryGetLine.target,
      discountStyle,
      fixedPriceNeedsUnitTotalChoice,
      buyConditionQty,
      rewardQty: Math.max(primaryGetLine.quantity, 1),
      singleBuyDiscount,
    });
  }, [
    intent,
    primaryGetLine,
    discountStyle,
    fixedPriceNeedsUnitTotalChoice,
    buyConditionQty,
    singleBuyDiscount,
  ]);

  const bundleBreakdown = useMemo(() => {
    if (!isBundle) {
      return null;
    }

    const lines = rule.buy
      .filter((line) => line.catalogKey.trim())
      .map((line) => {
        const unitPrice = parseMoneyValue(productPrice(products, line.catalogKey));

        return {
          id: line.id,
          label: labels[line.catalogKey] || line.catalogKey,
          quantity: line.quantity,
          unitPrice,
          subtotal: unitPrice * line.quantity,
        };
      });

    const normalTotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const promoTotal = parseMoneyValue(rule.bundlePrice || "$0");
    const savings = Math.max(normalTotal - promoTotal, 0);

    return { lines, normalTotal, promoTotal, savings };
  }, [isBundle, rule.buy, rule.bundlePrice, products, labels]);

  const discountBreakdown = useMemo(() => {
    if (intent !== "discount" || !primaryGetLine?.catalogKey.trim()) {
      return null;
    }

    const rewardQty = Math.max(primaryGetLine.quantity, 1);
    const rewardUnitPrice = parseMoneyValue(productPrice(products, primaryGetLine.catalogKey));
    const rewardLabel = labels[primaryGetLine.catalogKey] || primaryGetLine.catalogKey;
    const rewardNormal = rewardUnitPrice * rewardQty;
    const isNextUnit = primaryGetLine.target === "next_unit";

    let rewardPromo = rewardNormal;

    if (discountStyle === "percent") {
      const percent = Math.min(Math.max(primaryGetLine.percent ?? 0, 0), 100);
      rewardPromo = rewardNormal * (1 - percent / 100);
    } else if (discountStyle === "unit_price") {
      rewardPromo = parseMoneyValue(primaryGetLine.amount || "$0") * rewardQty;
    } else {
      rewardPromo = parseMoneyValue(primaryGetLine.amount || "$0");
    }

    const rewardSavings = Math.max(rewardNormal - rewardPromo, 0);
    const rewardSavingsPercent =
      rewardNormal > 0 ? Math.round((rewardSavings / rewardNormal) * 100) : 0;

    if (isNextUnit) {
      const buyRows = rule.buy
        .filter((line) => line.catalogKey.trim())
        .map((line) => {
          const unitPrice = parseMoneyValue(productPrice(products, line.catalogKey));

          return {
            id: line.id,
            label: labels[line.catalogKey] || line.catalogKey,
            quantity: line.quantity,
            unitPrice,
            subtotal: unitPrice * line.quantity,
          };
        });

      const buyTotal = buyRows.reduce((sum, row) => sum + row.subtotal, 0);

      return {
        kind: "next_unit" as const,
        buyRows,
        buyTotal,
        rewardQty,
        rewardLabel,
        rewardUnitPrice,
        rewardNormal,
        rewardPromo,
        normalTotal: buyTotal + rewardNormal,
        promoTotal: buyTotal + rewardPromo,
        savings: rewardSavings,
        savingsPercent: rewardSavingsPercent,
      };
    }

    return {
      kind: "same_purchase" as const,
      label: rewardLabel,
      qty: rewardQty,
      unitPrice: rewardUnitPrice,
      normalTotal: rewardNormal,
      promoTotal: rewardPromo,
      savings: rewardSavings,
      savingsPercent: rewardSavingsPercent,
    };
  }, [intent, primaryGetLine, discountStyle, products, labels, rule.buy]);

  useEffect(() => {
    if (rule.mode !== "bundle_price" || isBundlePromotionEligible(rule)) {
      return;
    }

    const coerced = coerceSingleProductBundleRule(rule);
    queueMicrotask(() => {
      setPickedIntent("discount");
      onChange(ensureComboRuleLineIds(syncSingleProductDiscount(coerced, labels)));
    });
  }, [rule, labels, onChange]);

  function commit(nextRule: ComboRule) {
    let coerced = coerceSingleProductBundleRule(nextRule);
    coerced = pruneDiscountTargetForBuy(coerced, labels, discountTargetMode);

    if (nextRule.mode === "bundle_price" && coerced.mode !== "bundle_price") {
      setPickedIntent("discount");
    }

    onChange(ensureComboRuleLineIds(syncSingleProductDiscount(coerced, labels)));
  }

  function resetIntent() {
    setPickedIntent(null);
  }

  function selectIntent(nextIntent: RuleIntent) {
    setPickedIntent(nextIntent);
    const buy = rule.buy.filter((line) => line.catalogKey.trim());

    if (nextIntent === "discount") {
      const unique = uniqueBuyProducts(buy, labels);
      const catalogKey = unique.length === 1 ? unique[0].catalogKey : "";
      setDiscountTargetMode("buy");
      commit(buildDiscountRule(buy, catalogKey));
      return;
    }

    if (nextIntent === "free_gift") {
      commit(buildFreeGiftRule(buy, ""));
      return;
    }

    if (!isBundlePromotionEligible({ buy })) {
      return;
    }

    commit(buildBundleRule(buy, products));
  }

  function addFirstBuyLine() {
    resetIntent();
    commit({
      ...rule,
      mode: "reward",
      buy: [{ id: createComboLineId(), catalogKey: "", quantity: 1 }],
      get: [],
      bundlePrice: undefined,
    });
  }

  function updateBuyLine(lineId: string, patch: Partial<ComboBuyLine>) {
    commit({
      ...rule,
      buy: rule.buy.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    });
  }

  function addBuyLine() {
    commit({
      ...rule,
      buy: [
        ...rule.buy,
        {
          id: createComboLineId(),
          catalogKey: "",
          quantity: 1,
        },
      ],
    });
  }

  function removeBuyLine(lineId: string) {
    const buy = rule.buy.filter((line) => line.id !== lineId);

    if (!buy.length) {
      resetIntent();
      commit({ ...rule, buy: [], get: [], mode: "reward", bundlePrice: undefined });
      return;
    }

    commit({ ...rule, buy });
  }

  function updateGetLine(lineId: string, patch: Partial<ComboGetLine>) {
    commit({
      ...rule,
      get: rule.get.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    });
  }

  function setDiscountStyle(style: DiscountStyle) {
    if (!primaryGetLine) {
      return;
    }

    if (style === "percent") {
      updateGetLine(primaryGetLine.id, {
        kind: "percent_off",
        percent: primaryGetLine.percent && primaryGetLine.percent < 100 ? primaryGetLine.percent : 20,
        amount: "",
      });
      return;
    }

    if (style === "unit_price") {
      updateGetLine(primaryGetLine.id, {
        kind: "fixed_unit_price",
        amount: primaryGetLine.amount || "",
        percent: undefined,
      });
      return;
    }

    updateGetLine(primaryGetLine.id, {
      kind: "set_total",
      amount: primaryGetLine.amount || "",
      percent: undefined,
    });
  }

  function setGiftFromBuy(catalogKey: string) {
    if (!primaryGetLine) {
      return;
    }

    updateGetLine(primaryGetLine.id, {
      catalogKey,
      kind: "percent_off",
      percent: 100,
      amount: "",
      target: "same_purchase",
    });
  }

  const buyGiftShortcuts = buyProducts;

  function addExtraGiftLine() {
    commit({
      ...rule,
      get: [
        ...rule.get,
        {
          id: createComboLineId(),
          catalogKey: "",
          quantity: 1,
          kind: "percent_off",
          percent: 100,
          target: "same_purchase",
        },
      ],
    });
  }

  function removeGetLine(lineId: string) {
    const get = rule.get.filter((line) => line.id !== lineId);

    if (!get.length) {
      resetIntent();
      commit({ ...rule, get: [], mode: "reward" });
      return;
    }

    commit({ ...rule, get });
  }

  if (!products.length) {
    return (
      <div className="rounded-xl border border-dashed border-amber-600/40 bg-amber-950/20 px-4 py-3 text-center text-sm font-black text-amber-200">
        Sin productos en este país
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
      <div className="grid gap-2">
        <StepSection step={1} label="Elegir">
          {hasBuyLines ? (
            <div className="grid gap-2">
              {rule.buy.map((line, index) => (
                <div key={line.id} className={productRowClass}>
                  <QtyInput
                    value={line.quantity}
                    onChange={(quantity) => updateBuyLine(line.id, { quantity })}
                    ariaLabel={`Cantidad producto ${index + 1}`}
                  />
                  <InlineSearchPicker
                    options={productPickerOptions(
                      products,
                      rule.buy.map((entry) => entry.catalogKey),
                      line.catalogKey,
                    )}
                    value={line.catalogKey}
                    onChange={(value) => updateBuyLine(line.id, { catalogKey: value })}
                    placeholder="Producto"
                    searchPlaceholder="Buscar…"
                    emptyLabel="Sin productos"
                    minWidthClass={productPickerMinWidth}
                    className={productPickerClass}
                    shellClassName={productPickerShellClass}
                    formatSelectedLabel={(option, placeholder) => option?.label || placeholder}
                  />
                  <RowActions>
                    <button
                      type="button"
                      onClick={() => removeBuyLine(line.id)}
                      className={iconButtonDangerClass}
                      aria-label={`Quitar producto ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </RowActions>
                </div>
              ))}
              <AddLineButton onClick={addBuyLine} label="Agregar producto" />

              {intent === "bundle_price" && bundleBreakdown?.lines.length ? (
                <div className="grid gap-2 rounded-lg border border-black bg-surface-card p-2.5">
                  <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-300">
                    <span>Suma normal</span>
                    <span className="tabular-nums text-[#f8fafc]">
                      {formatMoneyValue(bundleBreakdown.normalTotal)}
                    </span>
                  </div>
                  <label className="flex items-center justify-between gap-3 border-t border-black pt-2 text-xs font-black text-slate-300">
                    Precio paquete
                    <span className="flex items-center gap-1">
                      <span className="text-sm font-black text-slate-300">$</span>
                      <input
                        className={`${inputClass} h-10 w-28 px-2 text-center tabular-nums`}
                        inputMode="decimal"
                        value={moneyInputDisplayValue(rule.bundlePrice || "$0")}
                        onChange={(event) =>
                          commit({
                            ...rule,
                            bundlePrice: event.target.value
                              ? `$${event.target.value.replace(/[^\d.]/g, "")}`
                              : "$0",
                          })
                        }
                        aria-label="Precio total del paquete"
                      />
                    </span>
                  </label>
                  {bundleBreakdown.promoTotal > 0 &&
                  bundleBreakdown.normalTotal > 0 &&
                  bundleBreakdown.savings > 0 ? (
                    <div className="flex items-center justify-between gap-3 border-t border-black pt-2 text-sm font-bold text-emerald-300">
                      <span>Ahorro</span>
                      <span className="tabular-nums">
                        {formatMoneyValue(bundleBreakdown.savings)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={addFirstBuyLine}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-600/40 bg-surface-inset text-sm font-black text-emerald-300 transition hover:border-emerald-500 hover:bg-surface-card-hover"
            >
              <Plus className="h-4 w-4" />
              Agregar producto
            </button>
          )}
        </StepSection>

        <StepSection step={2} label="Acción">
          {hasBuyProducts ? (
            <>
              <IntentPills
                value={intent}
                onChange={selectIntent}
                bundleEligible={bundleEligible}
              />

              {intent === "discount" && primaryGetLine ? (
                <div className="mt-3 grid gap-2.5 border-t border-black pt-3">
                  {!singleBuyDiscount ? (
                    <div className="grid gap-2">
                      {discountTargetMode === "buy" ? (
                        <label className="grid gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Descuento en producto de la compra
                          </span>
                          <InlineSearchPicker
                            options={buyFromDiscountOptions}
                            value={primaryGetLine.catalogKey}
                            onChange={(value) =>
                              updateGetLine(primaryGetLine.id, { catalogKey: value })
                            }
                            placeholder="Elige un producto del paso 1"
                            searchPlaceholder="Buscar…"
                            emptyLabel="Sin productos"
                            minWidthClass={productPickerMinWidth}
                            className={productPickerClass}
                            shellClassName={productPickerShellClass}
                            formatSelectedLabel={(option, placeholder) =>
                              option?.label || placeholder
                            }
                          />
                        </label>
                      ) : (
                        <label className="grid gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Descuento en otro producto
                          </span>
                          <InlineSearchPicker
                            options={catalogDiscountOptions}
                            value={primaryGetLine.catalogKey}
                            onChange={(value) =>
                              updateGetLine(primaryGetLine.id, { catalogKey: value })
                            }
                            placeholder="Elige del catálogo"
                            searchPlaceholder="Buscar…"
                            emptyLabel="Sin productos"
                            minWidthClass={productPickerMinWidth}
                            className={productPickerClass}
                            shellClassName={productPickerShellClass}
                            formatSelectedLabel={(option, placeholder) =>
                              option?.label || placeholder
                            }
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = discountTargetMode === "buy" ? "other" : "buy";
                          setDiscountTargetMode(nextMode);
                          updateGetLine(primaryGetLine.id, { catalogKey: "" });
                        }}
                        className="text-left text-xs font-black text-emerald-300 transition hover:text-emerald-200"
                      >
                        {discountTargetMode === "buy"
                          ? "Descontar otro producto del catálogo"
                          : "Usar un producto de la compra"}
                      </button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex shrink-0 rounded-lg border border-black bg-surface-inset p-0.5">
                      {discountStyleOptions.map((option) => {
                        const active =
                          option.value === "percent"
                            ? discountStyle === "percent"
                            : fixedPriceNeedsUnitTotalChoice
                              ? discountStyle === option.value
                              : discountStyle === "unit_price" || discountStyle === "set_total";

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDiscountStyle(option.value)}
                            className={`h-9 rounded-md px-2.5 text-xs font-black transition sm:px-3 ${
                              active
                                ? "bg-emerald-400 text-slate-950"
                                : "text-slate-300 hover:text-[#f8fafc]"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {discountStyle === "percent" ? (
                      <label className="flex items-center gap-1">
                        <input
                          className={`${inputClass} h-10 w-16 px-2 text-center tabular-nums`}
                          inputMode="decimal"
                          value={primaryGetLine.percent ?? 0}
                          onChange={(event) =>
                            updateGetLine(primaryGetLine.id, {
                              kind: "percent_off" as ComboBenefitKind,
                              percent: Math.min(
                                Math.max(Number(event.target.value) || 0, 0),
                                100,
                              ),
                            })
                          }
                          aria-label="Porcentaje"
                        />
                        <span className="text-sm font-black text-slate-300">%</span>
                      </label>
                    ) : (
                      <label className="flex items-center gap-1">
                        <span className="text-sm font-black text-slate-300">$</span>
                        <input
                          className={`${inputClass} h-10 w-24 px-2 text-center tabular-nums`}
                          inputMode="decimal"
                          placeholder="0"
                          value={moneyInputDisplayValue(primaryGetLine.amount || "$0")}
                          onChange={(event) =>
                            updateGetLine(primaryGetLine.id, {
                              kind:
                                discountStyle === "set_total"
                                  ? "set_total"
                                  : "fixed_unit_price",
                              amount: event.target.value
                                ? `$${event.target.value.replace(/[^\d.]/g, "")}`
                                : "",
                            })
                          }
                          aria-label="Monto"
                        />
                      </label>
                    )}

                    <InlineSearchPicker
                      options={targetOptions}
                      value={primaryGetLine.target}
                      onChange={(value) =>
                        updateGetLine(primaryGetLine.id, {
                          target: value === "next_unit" ? "next_unit" : "same_purchase",
                        })
                      }
                      placeholder="Cuándo"
                      searchPlaceholder="Buscar…"
                      emptyLabel="Sin opciones"
                      minWidthClass="min-w-[9rem]"
                      className="min-w-[9rem] flex-1"
                      shellClassName={`${compactPickerShellClass} min-w-[9rem] flex-1`}
                      formatSelectedLabel={(option, placeholder) => option?.label || placeholder}
                    />
                  </div>

                  {discountHelperText ? (
                    <p className={helperTextClass}>{discountHelperText}</p>
                  ) : null}

                  {discountBreakdown &&
                  (discountBreakdown.kind === "next_unit"
                    ? discountBreakdown.rewardUnitPrice > 0
                    : discountBreakdown.unitPrice > 0) ? (
                    <div className="grid gap-1.5 rounded-lg border border-black bg-surface-inset p-2.5 text-sm">
                      {discountBreakdown.kind === "next_unit" ? (
                        <>
                          {discountBreakdown.buyRows.map((row) => (
                            <div
                              key={row.id}
                              className="flex items-center justify-between gap-3 font-bold text-slate-300"
                            >
                              <span className="min-w-0 truncate">
                                {row.quantity}× {row.label}
                                <span className="ml-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                                  condición
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-[#f8fafc]">
                                {formatMoneyValue(row.subtotal)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between gap-3 font-bold text-slate-300">
                            <span className="min-w-0 truncate">
                              {discountBreakdown.rewardQty}× {discountBreakdown.rewardLabel}
                              <span className="ml-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                                siguiente
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2 tabular-nums">
                              {discountBreakdown.rewardPromo < discountBreakdown.rewardNormal ? (
                                <span className="text-slate-500 line-through">
                                  {formatMoneyValue(discountBreakdown.rewardNormal)}
                                </span>
                              ) : null}
                              <span className="text-[#f8fafc]">
                                {formatMoneyValue(discountBreakdown.rewardPromo)}
                              </span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-3 font-bold text-slate-300">
                          <span className="min-w-0 truncate">
                            {singleBuyDiscount
                              ? "En la compra"
                              : `${discountBreakdown.qty}× ${discountBreakdown.label}`}
                          </span>
                          <span className="shrink-0 tabular-nums text-[#f8fafc]">
                            {formatMoneyValue(discountBreakdown.normalTotal)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 border-t border-black pt-2 font-black text-[#f8fafc]">
                        <span>Cliente paga</span>
                        <span className="tabular-nums">
                          {formatMoneyValue(discountBreakdown.promoTotal)}
                        </span>
                      </div>
                      {discountBreakdown.savings > 0 && discountStyle === "percent" ? (
                        <div className="flex items-center justify-between gap-3 font-bold text-emerald-300">
                          <span>Descuento</span>
                          <span className="tabular-nums">
                            {formatMoneyValue(discountBreakdown.savings)}
                            <span className="text-slate-400">
                              {" "}
                              ({discountBreakdown.savingsPercent}%)
                            </span>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className={helperTextClass}>Agrega productos arriba</p>
          )}
        </StepSection>

        {hasBuyProducts && intent ? (
          <StepSection label="Por venta">
            <RepeatPills
              value={rule.repeat}
              onChange={(repeat) => commit({ ...rule, repeat })}
            />
          </StepSection>
        ) : null}
      </div>

      <div className="grid gap-2">
        {hasBuyProducts && intent === "free_gift" ? (
          <StepSection step={3} label="Recibe">
            <div className="grid gap-2.5">
              {buyGiftShortcuts.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {buyGiftShortcuts.map((item) => {
                    const active = primaryGetLine?.catalogKey === item.catalogKey;

                    return (
                      <button
                        key={item.catalogKey}
                        type="button"
                        onClick={() => setGiftFromBuy(item.catalogKey)}
                        className={`h-9 rounded-lg border px-3 text-xs font-black transition ${
                          active
                            ? "border-emerald-500/50 bg-emerald-400/15 text-emerald-200"
                            : "border-black bg-surface-inset text-slate-200 hover:bg-surface-card-hover"
                        }`}
                      >
                        {item.label} gratis
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {rule.get.map((line, index) => (
                <div key={line.id} className={productRowClass}>
                  <QtyInput
                    value={line.quantity}
                    onChange={(quantity) => updateGetLine(line.id, { quantity })}
                    ariaLabel={`Cantidad regalo ${index + 1}`}
                  />
                  <InlineSearchPicker
                    options={productPickerOptions(
                      products,
                      rule.get.map((entry) => entry.catalogKey),
                      line.catalogKey,
                      { includeAny: false },
                    )}
                    value={line.catalogKey}
                    onChange={(value) =>
                      updateGetLine(line.id, {
                        catalogKey: value,
                        kind: "percent_off",
                        percent: 100,
                        amount: "",
                      })
                    }
                    placeholder="Elige el regalo"
                    searchPlaceholder="Buscar…"
                    emptyLabel="Sin productos"
                    minWidthClass={productPickerMinWidth}
                    className={productPickerClass}
                    shellClassName={productPickerShellClass}
                    formatSelectedLabel={(option, placeholder) => option?.label || placeholder}
                  />
                  <RowActions>
                    {rule.get.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeGetLine(line.id)}
                        className={iconButtonDangerClass}
                        aria-label={`Quitar regalo ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </RowActions>
                </div>
              ))}
              <AddLineButton onClick={addExtraGiftLine} label="Agregar otro regalo" />
            </div>
          </StepSection>
        ) : null}

        {hasBuyProducts && intent ? (
          <p className={summaryTextClass}>{describeComboRule(rule, labels)}</p>
        ) : null}
      </div>
    </div>
  );
}
