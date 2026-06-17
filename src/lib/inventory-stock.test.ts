import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CategoryConfig } from "@/lib/inventory-tree";
import {
  inventoryItemsForLeaf,
  leafStockMetrics,
  mergeTreeIntoInventoryItems,
  resolveCategoryStockItems,
  resolveSubcategoryStockItems,
  stockBucketCounts,
  stockLevelForItem,
  worstStockLevel,
  type InventoryStockItem,
} from "./inventory-stock";

const sampleTree: CategoryConfig[] = [
  {
    name: "Cajas",
    items: [
      {
        id: "sub-1",
        name: "Medidas",
        children: [
          { id: "1", name: "12x12x12" },
          { id: "2", name: "14x14x14" },
        ],
      },
    ],
  },
];

function stockItem(
  overrides: Partial<InventoryStockItem> & Pick<InventoryStockItem, "kind">,
): InventoryStockItem {
  return {
    id: overrides.id || "db-1",
    name: overrides.name || overrides.kind,
    category: overrides.category || "Cajas",
    kind: overrides.kind,
    subcategory: overrides.subcategory,
    stock: overrides.stock ?? 10,
    reserved: overrides.reserved ?? 0,
    assigned: overrides.assigned ?? 0,
    unavailable: overrides.unavailable ?? 0,
    minStock: overrides.minStock ?? 2,
  };
}

describe("inventory-stock", () => {
  it("classifies stock levels", () => {
    assert.equal(stockLevelForItem({ stock: 0, minStock: 2 }), "empty");
    assert.equal(stockLevelForItem({ stock: 2, minStock: 2 }), "low");
    assert.equal(stockLevelForItem({ stock: 5, minStock: 2 }), "ok");
  });

  it("picks the worst stock level from a list", () => {
    assert.equal(worstStockLevel(["ok", "low", "ok"]), "low");
    assert.equal(worstStockLevel(["ok", "empty"]), "empty");
    assert.equal(worstStockLevel([]), "neutral");
  });

  it("merges tree leaves into inventory items without duplicates", () => {
    const existing = [
      stockItem({
        id: "db-1",
        kind: "12x12x12",
        subcategory: "Medidas",
      }),
    ];

    const merged = mergeTreeIntoInventoryItems(sampleTree, existing);

    assert.equal(merged.length, 2);
    assert.ok(merged.some((item) => item.kind === "14x14x14"));
    assert.ok(merged.every((item) => item.id.startsWith("db-") || item.id.startsWith("inv-")));
  });

  it("aggregates leaf stock metrics", () => {
    const metrics = leafStockMetrics([
      stockItem({ kind: "12x12x12", stock: 5, assigned: 2, unavailable: 1, minStock: 3 }),
      stockItem({ kind: "14x14x14", stock: 1, assigned: 0, unavailable: 0, minStock: 5 }),
    ]);

    assert.equal(metrics.warehouse, 6);
    assert.equal(metrics.assigned, 2);
    assert.equal(metrics.unavailable, 1);
    assert.equal(metrics.minStock, 5);
    assert.equal(metrics.level, "ok");
  });

  it("marks aggregated leaf metrics as low when total is at min stock", () => {
    const metrics = leafStockMetrics([
      stockItem({ kind: "12x12x12", stock: 2, minStock: 5 }),
      stockItem({ kind: "14x14x14", stock: 1, minStock: 3 }),
    ]);

    assert.equal(metrics.warehouse, 3);
    assert.equal(metrics.minStock, 5);
    assert.equal(metrics.level, "low");
  });

  it("returns virtual items when category has no stock rows", () => {
    const virtual = resolveCategoryStockItems([], sampleTree[0]!);

    assert.equal(virtual.length, 2);
    assert.match(virtual[0]?.id || "", /^virtual-cajas-/);
    assert.equal(virtual[0]?.stock, 0);
    assert.equal(virtual[0]?.kind, "12x12x12");
  });

  it("returns virtual subcategory items when no stock rows match", () => {
    const virtual = resolveSubcategoryStockItems([], sampleTree[0]!, "Medidas", [
      "12x12x12",
      "14x14x14",
    ]);

    assert.equal(virtual.length, 2);
    assert.match(virtual[0]?.id || "", /^virtual-sub-medidas-/);
    assert.equal(virtual[0]?.subcategory, "Medidas");
  });

  it("matches leaf items case-insensitively", () => {
    const items = [
      stockItem({
        id: "db-2",
        kind: "14x14x14",
        subcategory: "Medidas",
        category: "Cajas",
      }),
    ];

    const matched = inventoryItemsForLeaf(items, "Cajas", "14x14x14", "Medidas");
    assert.equal(matched.length, 1);
    assert.equal(matched[0]?.id, "db-2");
  });

  it("counts stock buckets", () => {
    const buckets = stockBucketCounts([
      stockItem({ kind: "a", stock: 10, minStock: 2 }),
      stockItem({ kind: "b", stock: 2, minStock: 2 }),
      stockItem({ kind: "c", stock: 0, minStock: 2 }),
    ]);

    assert.deepEqual(buckets, { ok: 1, low: 1, empty: 1 });
  });
});
