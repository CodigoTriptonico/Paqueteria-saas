import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInventoryCustodyEmptyRows,
  buildInventoryCustodyFullCounts,
  inventoryCustodyRowKey,
  sumInventoryCustodyEmptyRows,
  sumInventoryCustodyFullCounts,
  sumTruckQtyByCatalogKey,
} from "@/lib/inventory-custody";
import type { InventoryStockItem } from "@/lib/inventory-stock";

function stockItem(overrides: Partial<InventoryStockItem> = {}): InventoryStockItem {
  return {
    id: "item-1",
    name: "Caja grande",
    category: "Cajas",
    kind: "Caja grande",
    subcategory: "Caja grande",
    size: "M",
    stock: 100,
    reserved: 10,
    assigned: 5,
    unavailable: 2,
    minStock: 20,
    ...overrides,
  };
}

describe("inventory custody", () => {
  it("builds empty custody rows across warehouse, truck and agencies", () => {
    const rows = buildInventoryCustodyEmptyRows({
      items: [stockItem()],
      truckBalances: [
        {
          vehicleId: "vehicle-1",
          vehicleName: "Camión 1",
          vehiclePlate: "ABC-123",
          assignedDriverId: "driver-1",
          assignedDriverName: "Conductor",
          totalQty: 12,
          lines: [
            {
              key: "catalog:cajas|caja grande|m",
              catalogKey: "Cajas|Caja grande|M",
              label: "Caja grande · M",
              requiredQty: 0,
              loadedQty: 12,
              deliveredQty: 0,
              returnedQty: 0,
              currentQty: 12,
              shortageQty: 0,
            },
          ],
        },
      ],
      agencyRows: [
        {
          agencyId: "agency-1",
          agencyName: "Agencia Norte",
          productKey: "Caja grande",
          boxSize: "M",
          availableQuantity: 30,
          allocatedQuantity: 8,
          deliveredQuantity: 38,
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.warehouseAvailable, 90);
    assert.equal(rows[0]?.reserved, 10);
    assert.equal(rows[0]?.assigned, 5);
    assert.equal(rows[0]?.onTruck, 12);
    assert.equal(rows[0]?.atAgencyAvailable, 30);
    assert.equal(rows[0]?.atAgencyAllocated, 8);
    assert.equal(rows[0]?.unavailable, 2);
  });

  it("does not double count truck quantities for duplicate stock rows", () => {
    const rows = buildInventoryCustodyEmptyRows({
      items: [stockItem(), stockItem({ id: "item-2", stock: 20 })],
      truckBalances: [
        {
          vehicleId: "vehicle-1",
          vehicleName: "Camión 1",
          vehiclePlate: "ABC-123",
          assignedDriverId: null,
          assignedDriverName: "",
          totalQty: 7,
          lines: [
            {
              key: "catalog:cajas|caja grande|m",
              catalogKey: "Cajas|Caja grande|M",
              label: "Caja grande · M",
              requiredQty: 0,
              loadedQty: 7,
              deliveredQty: 0,
              returnedQty: 0,
              currentQty: 7,
              shortageQty: 0,
            },
          ],
        },
      ],
    });

    assert.equal(rows[0]?.onTruck, 7);
    assert.equal(sumInventoryCustodyEmptyRows(rows).warehouseAvailable, 100);
  });

  it("normalizes custody keys and full package counts", () => {
    assert.equal(inventoryCustodyRowKey("Caja Grande", "M"), inventoryCustodyRowKey("caja grande", "m"));

    const fullCounts = buildInventoryCustodyFullCounts({
      in_warehouse: 4,
      on_pallet: 2,
      handed_to_carrier: 1,
      awaiting_full_box: 0,
    });

    assert.deepEqual(
      fullCounts.map((row) => row.status),
      ["in_warehouse", "on_pallet", "handed_to_carrier"],
    );
    assert.equal(sumInventoryCustodyFullCounts(fullCounts), 7);
  });

  it("aggregates truck quantities by catalog key", () => {
    const totals = sumTruckQtyByCatalogKey([
      {
        vehicleId: "vehicle-1",
        vehicleName: "Camión 1",
        vehiclePlate: "ABC-123",
        assignedDriverId: null,
        assignedDriverName: "",
        totalQty: 5,
        lines: [
          {
            key: "catalog:cajas|caja grande|m",
            catalogKey: "Cajas|Caja grande|M",
            label: "Caja grande · M",
            requiredQty: 0,
            loadedQty: 5,
            deliveredQty: 0,
            returnedQty: 0,
            currentQty: 5,
            shortageQty: 0,
          },
        ],
      },
    ]);

    assert.equal(totals.get("catalog:cajas|caja grande|m"), 5);
  });
});
