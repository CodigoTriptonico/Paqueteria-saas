export type EntryCostAnchor = "unit" | "total" | "qty";

function parsePositiveNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function formatCost(value: number, decimals: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "";
  }

  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

export function syncEntryCostFields(input: {
  qty: string;
  unitCost: string;
  totalCost: string;
  anchor: EntryCostAnchor;
}): { unitCost: string; totalCost: string } {
  const qty = parsePositiveNumber(input.qty);

  if (!qty || qty <= 0) {
    return {
      unitCost: input.unitCost,
      totalCost: input.totalCost,
    };
  }

  if (input.anchor === "total") {
    const totalCost = parsePositiveNumber(input.totalCost);

    if (totalCost == null) {
      return {
        unitCost: input.unitCost,
        totalCost: input.totalCost,
      };
    }

    return {
      unitCost: formatCost(totalCost / qty, 4),
      totalCost: input.totalCost,
    };
  }

  if (input.anchor === "unit") {
    const unitCost = parsePositiveNumber(input.unitCost);

    if (unitCost == null) {
      return {
        unitCost: input.unitCost,
        totalCost: input.totalCost,
      };
    }

    return {
      unitCost: input.unitCost,
      totalCost: formatCost(unitCost * qty, 2),
    };
  }

  const unitCost = parsePositiveNumber(input.unitCost);
  const totalCost = parsePositiveNumber(input.totalCost);

  if (totalCost != null) {
    return {
      unitCost: formatCost(totalCost / qty, 4),
      totalCost: input.totalCost,
    };
  }

  if (unitCost != null) {
    return {
      unitCost: input.unitCost,
      totalCost: formatCost(unitCost * qty, 2),
    };
  }

  return {
    unitCost: input.unitCost,
    totalCost: input.totalCost,
  };
}

export function resolveEntryCostForSubmit(input: {
  qty: number;
  unitCost?: string;
  totalCost?: string;
}):
  | { ok: true; unitCost: number | null; totalCost: number | null }
  | { ok: false; error: string } {
  const unitRaw = input.unitCost?.trim() || "";
  const totalRaw = input.totalCost?.trim() || "";

  if (!unitRaw && !totalRaw) {
    return { ok: true, unitCost: null, totalCost: null };
  }

  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { ok: false, error: "Cantidad invalida para calcular costo" };
  }

  const unitParsed = unitRaw ? Number(unitRaw) : null;
  const totalParsed = totalRaw ? Number(totalRaw) : null;

  if (unitRaw && (unitParsed == null || !Number.isFinite(unitParsed) || unitParsed < 0)) {
    return { ok: false, error: "Costo unitario invalido" };
  }

  if (totalRaw && (totalParsed == null || !Number.isFinite(totalParsed) || totalParsed < 0)) {
    return { ok: false, error: "Costo total invalido" };
  }

  if (unitParsed != null && totalParsed != null) {
    return {
      ok: true,
      unitCost: unitParsed,
      totalCost: totalParsed,
    };
  }

  if (unitParsed != null) {
    return {
      ok: true,
      unitCost: unitParsed,
      totalCost: Math.round(unitParsed * input.qty * 100) / 100,
    };
  }

  return {
    ok: true,
    unitCost: Math.round((totalParsed as number) / input.qty * 10000) / 10000,
    totalCost: totalParsed as number,
  };
}

export function computeWeightedAverageCost(input: {
  currentStock: number;
  currentAvgCost: number;
  entryQty: number;
  entryUnitCost: number;
}) {
  const nextStock = input.currentStock + input.entryQty;

  if (nextStock <= 0) {
    return input.entryUnitCost;
  }

  const totalValue =
    input.currentStock * input.currentAvgCost + input.entryQty * input.entryUnitCost;

  return Math.round((totalValue / nextStock) * 10000) / 10000;
}
