import {
  stockBadgeToneClass,
  stockBucketCounts,
  stockSummary,
  type InventoryStockItem,
  type StockLevel,
} from "@/lib/inventory-stock";

type StockBadgeProps = {
  value: number;
  level: StockLevel;
  title?: string;
};

export function StockBadge({ value, level, title }: StockBadgeProps) {
  const tone = stockBadgeToneClass[level === "neutral" ? "empty" : level];

  return (
    <span
      className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border px-1.5 text-[11px] font-bold tabular-nums shadow-[0_1px_0_rgba(0,0,0,0.35)] ${tone}`}
      title={title}
      aria-label={title || `${value} en stock`}
    >
      {value}
    </span>
  );
}

type StockBadgeGroupProps = {
  items: InventoryStockItem[];
  title?: string;
};

/** Cajitas de color: una por estado (ok / bajo / vacío) cuando hay mezcla. */
export function StockBadgeGroup({ items, title }: StockBadgeGroupProps) {
  const buckets = stockBucketCounts(items);
  const parts: Array<{ level: Exclude<StockLevel, "neutral">; count: number; label: string }> =
    [];

  if (buckets.ok > 0) {
    parts.push({ level: "ok", count: buckets.ok, label: "Con stock" });
  }

  if (buckets.low > 0) {
    parts.push({ level: "low", count: buckets.low, label: "Stock bajo" });
  }

  if (buckets.empty > 0) {
    parts.push({ level: "empty", count: buckets.empty, label: "Sin stock" });
  }

  if (!parts.length) {
    return <StockBadge value={0} level="empty" title={title || "Sin stock"} />;
  }

  if (parts.length === 1) {
    const [only] = parts;

    return (
      <StockBadge
        value={only.count}
        level={only.level}
        title={title || only.label}
      />
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-0.5" title={title}>
      {parts.map((part) => (
        <StockBadge key={part.level} value={part.count} level={part.level} title={part.label} />
      ))}
    </span>
  );
}

/** Total con color, o varias cajitas si hay mezcla de estados. */
export function StockBadgeDisplay({ items, title }: StockBadgeGroupProps) {
  const { total, level } = stockSummary(items);
  const buckets = stockBucketCounts(items);
  const activeStates = [buckets.ok, buckets.low, buckets.empty].filter((count) => count > 0).length;

  if (activeStates <= 1) {
    return <StockBadge value={total} level={level} title={title || "Stock total"} />;
  }

  return <StockBadgeGroup items={items} title={title} />;
}
