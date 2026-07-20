export type InventoryWarehouseTransferStatus = "in_transit" | "received" | "cancelled";

export type InventoryWarehouseTransfer = {
  id: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  itemId: string;
  itemName: string;
  qty: number;
  status: InventoryWarehouseTransferStatus;
  note: string;
  outboundMovementId?: string | null;
  inboundMovementId?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  receivedBy?: string | null;
  receivedByName?: string | null;
  receivedAt?: string | null;
  cancelledBy?: string | null;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
};

export const inventoryWarehouseTransferStatusLabels: Record<
  InventoryWarehouseTransferStatus,
  string
> = {
  in_transit: "En tránsito",
  received: "Recibida",
  cancelled: "Cancelada",
};

export function inventoryWarehouseTransferDirection(
  transfer: Pick<InventoryWarehouseTransfer, "fromWarehouseId" | "toWarehouseId">,
  warehouseId: string,
): "outgoing" | "incoming" | "other" {
  if (transfer.fromWarehouseId === warehouseId) {
    return "outgoing";
  }

  if (transfer.toWarehouseId === warehouseId) {
    return "incoming";
  }

  return "other";
}

export function countOpenIncomingTransfers(
  transfers: InventoryWarehouseTransfer[],
  warehouseId: string,
) {
  return transfers.filter(
    (transfer) =>
      transfer.toWarehouseId === warehouseId && transfer.status === "in_transit",
  ).length;
}

export function availableWarehouseTransferQty(
  item: Pick<{ stock: number; reserved: number }, "stock" | "reserved">,
) {
  return Math.max(0, Number(item.stock || 0) - Number(item.reserved || 0));
}

export function validateWarehouseTransferInput(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  itemId: string;
  qty: number;
  availableQty: number;
}) {
  if (!input.fromWarehouseId || !input.toWarehouseId) {
    return { ok: false as const, error: "Selecciona bodega de origen y destino" };
  }

  if (input.fromWarehouseId === input.toWarehouseId) {
    return { ok: false as const, error: "Origen y destino deben ser distintos" };
  }

  if (!input.itemId) {
    return { ok: false as const, error: "Selecciona un producto" };
  }

  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false as const, error: "Indica una cantidad mayor a cero" };
  }

  if (input.qty > input.availableQty) {
    return {
      ok: false as const,
      error: `Solo hay ${input.availableQty} disponibles en origen`,
    };
  }

  return { ok: true as const };
}
