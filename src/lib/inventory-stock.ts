import {
  categoryItems,
  countCategoryLeafItems,
  isInventoryGroup,
  inventoryTreeItemExists,
  normalizeInventoryText,
  type CategoryConfig,
  type InventoryTreeItem,
} from "@/lib/inventory-tree";
import { DEFAULT_INVENTORY_UNIT } from "@/lib/inventory-units";

export type InventoryStockItem = {
  id: string;
  name: string;
  category: string;
  kind: string;
  subcategory?: string;
  size?: string;
  stock: number;
  reserved: number;
  assigned: number;
  unavailable: number;
  minStock: number;
  avgCost?: number;
  location?: string;
  unit?: string;
  photoUrl?: string;
};

export type StockLevel = "ok" | "low" | "empty" | "neutral";

export const stockBadgeToneClass: Record<StockLevel, string> = {
  ok: "border-emerald-600 bg-emerald-400 text-slate-950",
  low: "border-amber-600 bg-amber-400 text-slate-950",
  empty: "border-rose-600 bg-rose-400 text-slate-950",
  neutral: "border-black bg-surface-inset text-slate-300",
};

/** Fondo sólido de tarjeta por estado (misma lógica que badges, tono surface-card). */
export const stockCardClass: Record<StockLevel, string> = {
  ok: "border-black bg-[#3a4842] hover:bg-[#425048]",
  low: "border-black bg-[#484239] hover:bg-[#524a40]",
  empty: "border-black bg-[#483942] hover:bg-[#524248]",
  neutral: "border-black bg-surface-card hover:bg-surface-card-hover",
};

export const stockValueToneClass: Record<StockLevel, string> = {
  ok: "text-emerald-300",
  low: "text-amber-300",
  empty: "text-rose-300",
  neutral: "text-slate-200",
};


export function stockLevelForItem(
  item: Pick<InventoryStockItem, "stock" | "minStock">,
): StockLevel {
  if (item.stock <= 0) {
    return "empty";
  }

  if (item.stock <= item.minStock) {
    return "low";
  }

  return "ok";
}

export function worstStockLevel(levels: StockLevel[]): StockLevel {
  if (levels.includes("empty")) {
    return "empty";
  }

  if (levels.includes("low")) {
    return "low";
  }

  if (levels.includes("ok")) {
    return "ok";
  }

  return "neutral";
}

function sumStock(items: InventoryStockItem[]) {
  return items.reduce((total, item) => total + item.stock, 0);
}

function sumAssigned(items: InventoryStockItem[]) {
  return items.reduce((total, item) => total + (item.assigned ?? 0), 0);
}

function sumUnavailable(items: InventoryStockItem[]) {
  return items.reduce((total, item) => total + (item.unavailable ?? 0), 0);
}

export type LeafStockMetrics = {
  warehouse: number;
  assigned: number;
  unavailable: number;
  reserved: number;
  minStock: number;
  level: StockLevel;
};

export function inventoryItemFilterLabel(
  item: Pick<InventoryStockItem, "name" | "kind" | "subcategory" | "size">,
) {
  const base = item.name.trim() || item.subcategory?.trim() || item.kind.trim() || "Item";
  const size = item.size?.trim();

  return size && !base.toLowerCase().includes(size.toLowerCase())
    ? `${base} · ${size}`
    : base;
}

export function inventoryItemFilterOptions(items: ReadonlyArray<InventoryStockItem>) {
  const seen = new Set<string>();

  return items
    .map((item) => ({
      value: item.id,
      label: inventoryItemFilterLabel(item),
    }))
    .filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }

      seen.add(option.value);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

export function leafStockMetrics(items: InventoryStockItem[]): LeafStockMetrics {
  const warehouse = sumStock(items);
  const assigned = sumAssigned(items);
  const unavailable = sumUnavailable(items);
  const reserved = items.reduce((total, item) => total + item.reserved, 0);
  const minStock = Math.max(...items.map((item) => item.minStock || 0), 0);

  return {
    warehouse,
    assigned,
    unavailable,
    reserved,
    minStock,
    level: stockLevelForItem({ stock: warehouse, minStock }),
  };
}

function sameCategory(item: InventoryStockItem, categoryName: string) {
  return normalizeInventoryText(item.category) === normalizeInventoryText(categoryName);
}

function inventoryItemsForCategory(
  items: InventoryStockItem[],
  categoryName: string,
) {
  return items.filter((item) => sameCategory(item, categoryName));
}

function inventoryItemsForSubcategory(
  items: InventoryStockItem[],
  categoryName: string,
  subcategoryName: string,
  childKindNames: string[],
) {
  const childKinds = new Set(childKindNames.map((name) => normalizeInventoryText(name)));

  return items.filter((item) => {
    if (!sameCategory(item, categoryName)) {
      return false;
    }

    if (
      item.subcategory &&
      normalizeInventoryText(item.subcategory) === normalizeInventoryText(subcategoryName)
    ) {
      return true;
    }

    return childKinds.has(normalizeInventoryText(item.kind));
  });
}

export function inventoryItemsForLeaf(
  items: InventoryStockItem[],
  categoryName: string,
  leafName: string,
  subcategoryName?: string,
) {
  return items.filter((item) => {
    if (!sameCategory(item, categoryName)) {
      return false;
    }

    if (normalizeInventoryText(item.kind) !== normalizeInventoryText(leafName)) {
      return false;
    }

    if (subcategoryName) {
      return (
        !item.subcategory ||
        normalizeInventoryText(item.subcategory) === normalizeInventoryText(subcategoryName)
      );
    }

    return !item.subcategory;
  });
}

export type TreeLeafRef = {
  category: string;
  kind: string;
  subcategory?: string;
  name: string;
};

export function collectCategoryTreeLeaves(category: CategoryConfig): TreeLeafRef[] {
  const leaves: TreeLeafRef[] = [];

  for (const item of categoryItems(category)) {
    if (isInventoryGroup(item)) {
      for (const child of item.children || []) {
        leaves.push({
          category: category.name,
          kind: child.name,
          subcategory: item.name,
          name: child.name,
        });
      }

      continue;
    }

    leaves.push({
      category: category.name,
      kind: item.name,
      name: item.name,
    });
  }

  return leaves;
}

export function inventoryLeafKey(
  item: Pick<InventoryStockItem, "category" | "kind" | "subcategory">,
) {
  return [
    normalizeInventoryText(item.category),
    normalizeInventoryText(item.kind),
    normalizeInventoryText(item.subcategory || ""),
  ].join("|");
}

function inventoryItemKey(item: Pick<InventoryStockItem, "category" | "kind" | "subcategory">) {
  return inventoryLeafKey(item);
}

function isPersistedInventoryItemId(id: string) {
  return !id.startsWith("virtual-") && !id.startsWith("inv-");
}

function syncTreeItemId(categoryName: string, kind: string) {
  const categorySlug = normalizeInventoryText(categoryName).replace(/[^a-z0-9]+/g, "-");
  const kindSlug = normalizeInventoryText(kind).replace(/[^a-z0-9]+/g, "-");

  return `${categorySlug}-sync-${kindSlug}`;
}

function appendOrphanLeafToCategory(
  category: CategoryConfig & { items: InventoryTreeItem[] },
  item: InventoryStockItem,
): CategoryConfig & { items: InventoryTreeItem[] } {
  const items = categoryItems(category);

  if (item.subcategory) {
    const subcategoryName = item.subcategory;
    const groupIndex = items.findIndex(
      (node) =>
        isInventoryGroup(node) &&
        normalizeInventoryText(node.name) === normalizeInventoryText(subcategoryName),
    );
    const child: InventoryTreeItem = {
      id: syncTreeItemId(category.name, item.kind),
      name: item.kind,
    };

    if (groupIndex >= 0) {
      const group = items[groupIndex];

      if (inventoryTreeItemExists(group.children || [], item.kind)) {
        return category;
      }

      const nextItems = [...items];
      nextItems[groupIndex] = {
        ...group,
        children: [...(group.children || []), child],
      };

      return { ...category, items: nextItems };
    }

    return {
      ...category,
      items: [
        ...items,
        {
          id: `${syncTreeItemId(category.name, subcategoryName)}-group`,
          name: subcategoryName,
          children: [child],
        },
      ],
    };
  }

  if (inventoryTreeItemExists(items, item.kind)) {
    return category;
  }

  return {
    ...category,
    items: [
      ...items,
      {
        id: syncTreeItemId(category.name, item.kind),
        name: item.kind,
      },
    ],
  };
}

export function mergeOrphanItemsIntoCategoryConfigs(
  categoryConfigs: CategoryConfig[],
  items: InventoryStockItem[],
): CategoryConfig[] {
  const configs: Array<CategoryConfig & { items: InventoryTreeItem[] }> = categoryConfigs.map((category) => ({
    ...category,
    items: [...categoryItems(category)],
  }));
  const configsByName = new Map(
    configs.map((category) => [normalizeInventoryText(category.name), category]),
  );
  const treeKeys = new Set(
    configs.flatMap((category) =>
      collectCategoryTreeLeaves(category).map((leaf) => inventoryLeafKey(leaf)),
    ),
  );

  let changed = false;

  for (const item of items) {
    if (!isPersistedInventoryItemId(item.id)) {
      continue;
    }

    const key = inventoryLeafKey(item);

    if (treeKeys.has(key)) {
      continue;
    }

    const category = configsByName.get(normalizeInventoryText(item.category));

    if (!category) {
      continue;
    }

    const nextCategory = appendOrphanLeafToCategory(category, item);

    if (nextCategory === category) {
      continue;
    }

    configsByName.set(normalizeInventoryText(category.name), nextCategory);
    changed = true;

    for (const leaf of collectCategoryTreeLeaves(nextCategory)) {
      treeKeys.add(inventoryLeafKey(leaf));
    }
  }

  if (!changed) {
    return categoryConfigs;
  }

  return configs.map(
    (category) => configsByName.get(normalizeInventoryText(category.name)) || category,
  );
}

export function countInventoryArticles(categoryConfigs: CategoryConfig[]) {
  return categoryConfigs.reduce(
    (total, category) => total + countCategoryLeafItems(category),
    0,
  );
}

export function mergeTreeIntoInventoryItems(
  categoryConfigs: CategoryConfig[],
  items: InventoryStockItem[],
) {
  const merged = [...items];
  const existing = new Set(items.map((item) => inventoryItemKey(item)));

  for (const category of categoryConfigs) {
    for (const leaf of collectCategoryTreeLeaves(category)) {
      const key = inventoryItemKey(leaf);

      if (existing.has(key)) {
        continue;
      }

      merged.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: leaf.name,
        category: leaf.category,
        kind: leaf.kind,
        subcategory: leaf.subcategory,
        stock: 0,
        reserved: 0,
        assigned: 0,
        unavailable: 0,
        minStock: 2,
        unit: DEFAULT_INVENTORY_UNIT,
      });
      existing.add(key);
    }
  }

  return merged;
}

export function resolveCategoryStockItems(
  items: InventoryStockItem[],
  category: CategoryConfig,
) {
  const matched = inventoryItemsForCategory(items, category.name);

  if (matched.length) {
    return matched;
  }

  return collectCategoryTreeLeaves(category).map((leaf, index) => ({
    id: `virtual-${normalizeInventoryText(category.name)}-${index}`,
    name: leaf.name,
    category: leaf.category,
    kind: leaf.kind,
    subcategory: leaf.subcategory,
    stock: 0,
    reserved: 0,
    assigned: 0,
    unavailable: 0,
    minStock: 2,
    unit: DEFAULT_INVENTORY_UNIT,
  }));
}

export function resolveSubcategoryStockItems(
  items: InventoryStockItem[],
  category: CategoryConfig,
  subcategoryName: string,
  childKindNames: string[],
) {
  const matched = inventoryItemsForSubcategory(
    items,
    category.name,
    subcategoryName,
    childKindNames,
  );

  if (matched.length) {
    return matched;
  }

  return collectCategoryTreeLeaves(category)
    .filter(
      (leaf) =>
        leaf.subcategory &&
        normalizeInventoryText(leaf.subcategory) === normalizeInventoryText(subcategoryName),
    )
    .map((leaf, index) => ({
      id: `virtual-sub-${normalizeInventoryText(subcategoryName)}-${index}`,
      name: leaf.name,
      category: leaf.category,
      kind: leaf.kind,
      subcategory: leaf.subcategory,
      stock: 0,
      reserved: 0,
      assigned: 0,
      unavailable: 0,
      minStock: 2,
      unit: DEFAULT_INVENTORY_UNIT,
    }));
}

export function stockSummary(items: InventoryStockItem[]) {
  if (!items.length) {
    return { total: 0, level: "empty" as const };
  }

  const levels = items.map((item) => stockLevelForItem(item));

  return {
    total: sumStock(items),
    level: worstStockLevel(levels),
  };
}

export type StockBucketCounts = {
  ok: number;
  low: number;
  empty: number;
};

export function stockBucketCounts(items: InventoryStockItem[]): StockBucketCounts {
  const buckets: StockBucketCounts = { ok: 0, low: 0, empty: 0 };

  for (const item of items) {
    const level = stockLevelForItem(item);

    if (level === "ok") {
      buckets.ok += 1;
    } else if (level === "low") {
      buckets.low += 1;
    } else if (level === "empty") {
      buckets.empty += 1;
    }
  }

  return buckets;
}
