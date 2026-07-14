export type InventoryMovementType =
  | "entrada"
  | "salida"
  | "ajuste"
  | "asignacion"
  | "devolucion"
  | "consumo"
  | "dano"
  | "perdida";

export type InventoryMovement = {
  id: string;
  itemId: string;
  itemName: string;
  type: InventoryMovementType;
  qty: number;
  note: string;
  createdAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assignmentId?: string | null;
};

export type InventoryAssignmentOutcome =
  | "returned_intact"
  | "consumed"
  | "damaged"
  | "lost"
  | "partial";

type InventoryAssignmentStatus = "open" | "closed";

export type InventoryAssignment = {
  id: string;
  warehouseId: string;
  itemId: string;
  itemName: string;
  assigneeId: string;
  assigneeName: string;
  qtyAssigned: number;
  qtyReturned: number;
  qtyConsumed: number;
  qtyDamaged: number;
  qtyLost: number;
  status: InventoryAssignmentStatus;
  outcome: InventoryAssignmentOutcome | null;
  note: string;
  assignedBy?: string | null;
  assignedByName?: string | null;
  assignedAt: string;
  closedAt?: string | null;
};

export type InventoryMovementFilters = {
  warehouseId: string;
  itemId?: string;
  assigneeId?: string;
  type?: InventoryMovementType;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type InventoryAssignmentFilters = {
  warehouseId: string;
  itemId?: string;
  assigneeId?: string;
  status?: InventoryAssignmentStatus;
  query?: string;
};

export type InventoryMovementSummary = {
  assigneeId: string;
  assigneeName: string;
  itemId: string;
  itemName: string;
  openAssigned: number;
  consumed: number;
  damaged: number;
  lost: number;
  returned: number;
};
