import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import {
  buildEmptyBoxCustodyRows,
  buildFullBoxCustodyBuckets,
  buildInventoryCustodySnapshot,
  emptyRowTrackedTotal,
  sumEmptyBuckets,
} from "@/lib/inventory-custody";

function stockItem(
  overrides: Partial<InventoryStockItem> & Pick<InventoryStockItem, "id" | "name">,
): InventoryStockItem {
  return {
    category: "Cajas",
    kind: "Cartón",
    subcategory: "Grande",
    size: "L",
    stock: 0,
    reserved: 0,
    assigned: 0,
    unavailable: 0,
    minStock: 0,
    ...overrides,
  };
}

describe("inventory custody aggregation", () => {
  it("merges warehouse, truck, agency and unavailable buckets per item", () => {
    const rows = buildEmptyBoxCustodyRows({
      warehouseId: "wh-1",
      items: [
        stockItem({
          id: "item-1",
          name: "Caja grande L",
          subcategory: "Grande",
          size: "L",
          stock: 100,
          reserved: 5,
          assigned: 10,
          unavailable: 2,
        }),
        stockItem({
          id: "item-2",
          name: "Cinta",
          subcategory: "Cinta",
          size: "1",
          stock: 0,
        }),
      ],
      truckLines: [
        {
          itemId: "item-1",
          itemName: "Caja grande L",
          label: "Caja grande L",
          warehouseId: "wh-1",
          currentQty: 12,
        },
        {
          itemId: "item-1",
          itemName: "Caja grande L",
          label: "Caja grande L",
          warehouseId: "wh-other",
          currentQty: 99,
        },
      ],
      agencyLots: [
        {
          inventoryItemId: "item-1",
          productKey: "Grande",
          boxSize: "L",
          availableQuantity: 40,
          allocatedQuantity: 15,
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.buckets, {
      warehouse: 100,
      assigned: 10,
      reserved: 5,
      inTruck: 12,
      agencyAvailable: 40,
      agencyAllocated: 15,
      unavailable: 2,
    });
    assert.equal(emptyRowTrackedTotal(rows[0]!.buckets), 184);
  });

  it("matches agency lots by product key and size when item id is missing", () => {
    const rows = buildEmptyBoxCustodyRows({
      warehouseId: "wh-1",
      items: [
        stockItem({
          id: "item-1",
          name: "Grande L",
          subcategory: "Grande",
          size: "L",
          stock: 1,
        }),
      ],
      truckLines: [],
      agencyLots: [
        {
          inventoryItemId: null,
          productKey: "Grande",
          boxSize: "L",
          availableQuantity: 7,
          allocatedQuantity: 3,
        },
      ],
    });

    assert.equal(rows[0]?.buckets.agencyAvailable, 7);
    assert.equal(rows[0]?.buckets.agencyAllocated, 3);
  });

  it("builds ordered full-box status buckets and snapshot totals", () => {
    const fullBuckets = buildFullBoxCustodyBuckets({
      in_truck: 4,
      in_warehouse: 8,
      handed_to_carrier: 2,
    });

    assert.equal(fullBuckets[0]?.status, "awaiting_full_box");
    assert.equal(fullBuckets.find((row) => row.status === "in_warehouse")?.count, 8);

    const snapshot = buildInventoryCustodySnapshot({
      warehouseId: "wh-1",
      warehouseName: "Central",
      items: [
        stockItem({
          id: "item-1",
          name: "Caja",
          stock: 10,
          assigned: 2,
        }),
      ],
      truckLines: [],
      agencyLots: [],
      fullCountsByStatus: { in_truck: 4, in_warehouse: 8, handed_to_carrier: 2 },
    });

    assert.equal(snapshot.warehouseName, "Central");
    assert.equal(snapshot.fullTotal, 14);
    assert.deepEqual(sumEmptyBuckets(snapshot.emptyRows), snapshot.emptyTotals);
    assert.equal(snapshot.emptyTotals.warehouse, 10);
    assert.equal(snapshot.emptyTotals.assigned, 2);
  });
});
