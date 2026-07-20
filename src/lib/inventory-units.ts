import type { InventoryStockItem } from "@/lib/inventory-stock";

export const DEFAULT_INVENTORY_UNIT = "pieza";

export const INVENTORY_UNIT_PRESETS = [
  "pieza",
  "caja",
  "rollo",
  "paquete",
  "kg",
  "metro",
  "litro",
] as const;

const UNIT_PLURALS: Record<string, string> = {
  pieza: "piezas",
  caja: "cajas",
  rollo: "rollos",
  paquete: "paquetes",
  metro: "metros",
  litro: "litros",
};

const INVARIANT_UNITS = new Set(["kg"]);

export function normalizeInventoryUnit(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 24);
}

export function resolveInventoryItemUnit(
  stockItem: Pick<InventoryStockItem, "unit">,
  leafItems: Array<Pick<InventoryStockItem, "unit">> = [],
) {
  const direct = normalizeInventoryUnit(stockItem.unit);

  if (direct) {
    return direct;
  }

  for (const item of leafItems) {
    const unit = normalizeInventoryUnit(item.unit);

    if (unit) {
      return unit;
    }
  }

  return DEFAULT_INVENTORY_UNIT;
}

export function formatInventoryUnitPlural(unit: string, qty: number) {
  const normalized = normalizeInventoryUnit(unit) || DEFAULT_INVENTORY_UNIT;

  if (qty === 1 || INVARIANT_UNITS.has(normalized)) {
    return normalized;
  }

  return UNIT_PLURALS[normalized] || `${normalized}s`;
}

export function formatInventoryStockLabel(
  stockItem: Pick<InventoryStockItem, "unit">,
  qty: number,
  leafItems: Array<Pick<InventoryStockItem, "unit">> = [],
) {
  const unit = resolveInventoryItemUnit(stockItem, leafItems);
  return formatInventoryUnitPlural(unit, qty);
}
