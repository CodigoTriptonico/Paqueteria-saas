export type InventoryMovement = {
  id: string;
  itemId: string;
  itemName: string;
  type: "entrada" | "salida" | "ajuste";
  qty: number;
  note: string;
  createdAt: string;
};
