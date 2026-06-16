import type {
  InventoryAssignment,
  InventoryMovement,
  InventoryMovementType,
} from "@/lib/inventory-types";
import type { InventoryStockItem } from "@/lib/inventory-stock";
import type { CategoryConfig, InventoryTreeItem } from "@/lib/inventory-tree";

export type DbCategory = {
  id: string;
  name: string;
  tree_data: InventoryTreeItem[];
};

export type DbStockRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  stock: number;
  reserved: number;
  assigned: number;
  unavailable: number;
  min_stock: number;
  inventory_items: {
    id: string;
    name: string;
    kind: string;
    subcategory: string | null;
    size: string | null;
    location: string | null;
    unit: string | null;
    category_id: string;
    inventory_categories: { name: string };
  };
};

type ProfileJoin = { full_name: string | null; email: string } | null;

export type DbMovementRow = {
  id: string;
  item_id: string;
  item_name: string;
  type: InventoryMovementType;
  qty: number;
  note: string;
  created_at: string;
  created_by?: string | null;
  assignee_id?: string | null;
  assignment_id?: string | null;
  created_by_profile?: ProfileJoin | ProfileJoin[];
  assignee_profile?: ProfileJoin | ProfileJoin[];
};

export type DbAssignmentRow = {
  id: string;
  warehouse_id: string;
  item_id: string;
  item_name: string;
  assignee_id: string;
  qty_assigned: number;
  qty_returned: number;
  qty_consumed: number;
  qty_damaged: number;
  qty_lost: number;
  status: "open" | "closed";
  outcome: InventoryAssignment["outcome"];
  note: string;
  assigned_by: string | null;
  assigned_at: string;
  closed_at: string | null;
  assignee_profile?: ProfileJoin | ProfileJoin[];
  assigned_by_profile?: ProfileJoin | ProfileJoin[];
};

export function unwrapJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type DbStockJoinItem = {
  id: string;
  name: string;
  kind: string;
  subcategory: string | null;
  size: string | null;
  location: string | null;
  unit: string | null;
  inventory_categories: { name: string } | { name: string }[] | null;
};

export type DbStockJoinRow = {
  stock: number;
  reserved: number;
  assigned?: number;
  unavailable?: number;
  min_stock: number;
  inventory_items: DbStockJoinItem | DbStockJoinItem[] | null;
};

export function inventoryStockJoinToItem(
  itemId: string,
  row: DbStockJoinRow,
): InventoryStockItem | null {
  const itemRow = unwrapJoinedRow(row.inventory_items);

  if (!itemRow) {
    return null;
  }

  const category = unwrapJoinedRow(itemRow.inventory_categories);

  return {
    id: itemId,
    name: itemRow.name,
    category: category?.name || "",
    kind: itemRow.kind,
    subcategory: itemRow.subcategory || undefined,
    size: itemRow.size || undefined,
    location: itemRow.location || undefined,
    unit: itemRow.unit || undefined,
    stock: Number(row.stock),
    reserved: Number(row.reserved),
    assigned: Number(row.assigned ?? 0),
    unavailable: Number(row.unavailable ?? 0),
    minStock: Number(row.min_stock),
  };
}

export function profileDisplayName(
  profile?: ProfileJoin | ProfileJoin[] | null,
) {
  const row = Array.isArray(profile) ? profile[0] : profile;

  if (!row) {
    return null;
  }

  return row.full_name?.trim() || row.email;
}

export function categoriesToConfig(rows: DbCategory[]): CategoryConfig[] {
  return rows.map((row) => ({
    name: row.name,
    items: (row.tree_data || []) as InventoryTreeItem[],
  }));
}

export function stockRowsToItems(rows: DbStockRow[]): InventoryStockItem[] {
  return rows.map((row) => {
    const item = row.inventory_items;
    const categoryName = item.inventory_categories?.name || "";

    return {
      id: row.item_id,
      name: item.name,
      category: categoryName,
      kind: item.kind,
      subcategory: item.subcategory || undefined,
      size: item.size || undefined,
      location: item.location || undefined,
      unit: item.unit || undefined,
      stock: Number(row.stock),
      reserved: Number(row.reserved),
      assigned: Number(row.assigned ?? 0),
      unavailable: Number(row.unavailable ?? 0),
      minStock: Number(row.min_stock),
    };
  });
}

export function movementsFromDb(rows: DbMovementRow[]): InventoryMovement[] {
  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    type: row.type,
    qty: Number(row.qty),
    note: row.note || "",
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    createdByName: profileDisplayName(row.created_by_profile),
    assigneeId: row.assignee_id ?? null,
    assigneeName: profileDisplayName(row.assignee_profile),
    assignmentId: row.assignment_id ?? null,
  }));
}

export function assignmentsFromDb(rows: DbAssignmentRow[]): InventoryAssignment[] {
  return rows.map((row) => ({
    id: row.id,
    warehouseId: row.warehouse_id,
    itemId: row.item_id,
    itemName: row.item_name,
    assigneeId: row.assignee_id,
    assigneeName: profileDisplayName(row.assignee_profile) || row.assignee_id,
    qtyAssigned: Number(row.qty_assigned),
    qtyReturned: Number(row.qty_returned),
    qtyConsumed: Number(row.qty_consumed),
    qtyDamaged: Number(row.qty_damaged),
    qtyLost: Number(row.qty_lost),
    status: row.status,
    outcome: row.outcome,
    note: row.note || "",
    assignedBy: row.assigned_by,
    assignedByName: profileDisplayName(row.assigned_by_profile),
    assignedAt: row.assigned_at,
    closedAt: row.closed_at,
  }));
}

export const MOVEMENT_SELECT = `
  id, item_id, item_name, type, qty, note, created_at, created_by,
  assignee_id, assignment_id,
  created_by_profile:profiles!inventory_movements_created_by_fkey(full_name, email),
  assignee_profile:profiles!inventory_movements_assignee_id_fkey(full_name, email)
`;

export const ASSIGNMENT_SELECT = `
  id, warehouse_id, item_id, item_name, assignee_id,
  qty_assigned, qty_returned, qty_consumed, qty_damaged, qty_lost,
  status, outcome, note, assigned_by, assigned_at, closed_at,
  assignee_profile:profiles!inventory_assignments_assignee_id_fkey(full_name, email),
  assigned_by_profile:profiles!inventory_assignments_assigned_by_fkey(full_name, email)
`;
