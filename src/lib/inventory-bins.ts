export type WarehouseBin = {
  id: string;
  warehouseId: string;
  zone: string;
  aisle: string;
  shelf: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

export type InventoryBinPlacement = {
  binId: string;
  binCode: string;
  binLabel: string;
  quantity: number;
};

function normalizeBinSegment(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildWarehouseBinCode(input: {
  zone: string;
  aisle: string;
  shelf: string;
  code?: string;
}) {
  const explicit = normalizeBinSegment(input.code || "");
  if (explicit) {
    return explicit.toUpperCase();
  }

  const parts = [
    normalizeBinSegment(input.zone),
    normalizeBinSegment(input.aisle),
    normalizeBinSegment(input.shelf),
  ].filter(Boolean);

  if (!parts.length) {
    return "";
  }

  return parts.join("-").toUpperCase();
}

export function buildWarehouseBinLabel(input: {
  zone: string;
  aisle: string;
  shelf: string;
  label?: string;
  code: string;
}) {
  const explicit = normalizeBinSegment(input.label || "");
  if (explicit) {
    return explicit;
  }

  const parts: string[] = [];

  if (normalizeBinSegment(input.zone)) {
    parts.push(`Zona ${normalizeBinSegment(input.zone)}`);
  }

  if (normalizeBinSegment(input.aisle)) {
    parts.push(`Pasillo ${normalizeBinSegment(input.aisle)}`);
  }

  if (normalizeBinSegment(input.shelf)) {
    parts.push(`Estante ${normalizeBinSegment(input.shelf)}`);
  }

  if (parts.length) {
    return parts.join(" · ");
  }

  return input.code;
}

export function sumBinPlacementQuantity(placements: Pick<InventoryBinPlacement, "quantity">[]) {
  return placements.reduce((total, row) => total + Math.max(0, row.quantity), 0);
}

export function unplacedWarehouseQuantity(
  warehouseStock: number,
  placements: Pick<InventoryBinPlacement, "quantity">[],
) {
  return Math.max(0, warehouseStock - sumBinPlacementQuantity(placements));
}

export function validateBinPlacementQuantity(input: {
  warehouseStock: number;
  placements: Pick<InventoryBinPlacement, "binId" | "quantity">[];
  binId: string;
  nextQuantity: number;
}) {
  const safeNext = Math.max(0, input.nextQuantity);
  const otherTotal = input.placements
    .filter((row) => row.binId !== input.binId)
    .reduce((total, row) => total + Math.max(0, row.quantity), 0);
  const nextTotal = otherTotal + safeNext;

  if (nextTotal > input.warehouseStock) {
    const available = Math.max(0, input.warehouseStock - otherTotal);
    return {
      ok: false as const,
      error: `Solo puedes ubicar ${available} en este estante (stock en bodega: ${input.warehouseStock}).`,
    };
  }

  return { ok: true as const, quantity: safeNext };
}

export function formatBinPlacementSummary(
  placements: InventoryBinPlacement[],
  maxItems = 2,
) {
  if (!placements.length) {
    return "";
  }

  const sorted = [...placements].sort((left, right) => right.quantity - left.quantity);
  const visible = sorted.slice(0, maxItems);
  const summary = visible.map((row) => `${row.binCode}: ${row.quantity}`).join(" · ");
  const hidden = sorted.length - visible.length;

  if (hidden > 0) {
    return `${summary} · +${hidden}`;
  }

  return summary;
}
