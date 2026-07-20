import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addInventoryTreeChild,
  countCategoryLeafItems,
  deleteInventoryTreeItem,
  isInventoryGroup,
  inventoryTreeItemExists,
  normalizeInventoryName,
  updateInventoryTreeItem,
  type CategoryConfig,
  type InventoryTreeItem,
} from "./inventory-tree";

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

describe("inventory-tree", () => {
  it("detects groups vs direct items", () => {
    const group: InventoryTreeItem = { id: "g", name: "Medidas", children: [] };
    const leaf: InventoryTreeItem = { id: "l", name: "12x12x12" };

    assert.equal(isInventoryGroup(group), true);
    assert.equal(isInventoryGroup(leaf), false);
  });

  it("counts leaf items in a category", () => {
    assert.equal(countCategoryLeafItems(sampleTree[0]!), 2);
  });

  it("adds a child under a parent node", () => {
    const next = addInventoryTreeChild(sampleTree[0]!.items!, "sub-1", {
      id: "3",
      name: "16x16x16",
    });

    const medidas = next.find((item) => item.id === "sub-1");
    assert.equal(medidas?.children?.length, 3);
    assert.equal(medidas?.children?.[2]?.name, "16x16x16");
  });

  it("updates a tree item name by id", () => {
    const next = updateInventoryTreeItem(sampleTree[0]!.items!, "1", "10x10x10");
    const medidas = next.find((item) => item.id === "sub-1");
    const renamed = medidas?.children?.find((child) => child.id === "1");

    assert.equal(renamed?.name, "10x10x10");
  });

  it("deletes a tree item by id", () => {
    const next = deleteInventoryTreeItem(sampleTree[0]!.items!, "2");
    const medidas = next.find((item) => item.id === "sub-1");

    assert.equal(medidas?.children?.length, 1);
    assert.equal(medidas?.children?.[0]?.id, "1");
  });

  it("normalizes names to prevent case, accent, and whitespace duplicates", () => {
    assert.equal(normalizeInventoryName("  Cájás  "), "cajas");
    assert.equal(
      inventoryTreeItemExists([{ id: "1", name: "Cajas" }], " cajas "),
      true,
    );
  });
});
