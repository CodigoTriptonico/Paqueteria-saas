import { normalizeInventoryText } from "@/lib/inventory-tree";

export type EmptyBoxQuoteLine = {
  label: string;
  quantity: number;
};

export type EmptyBoxStockMatchRow = {
  id: string;
  item_id: string;
  stock: number;
  reserved: number;
  inventory_items:
    | { id: string; name: string; kind: string }
    | { id: string; name: string; kind: string }[]
    | null;
};

export type MatchedEmptyBoxDeduction = {
  quote: EmptyBoxQuoteLine;
  stockId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  available: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readInventoryItem(
  row: EmptyBoxStockMatchRow,
): { id: string; name: string; kind: string } | null {
  const itemRow = row.inventory_items;
  const item = Array.isArray(itemRow) ? itemRow[0] : itemRow;
  return item || null;
}

export function readEmptyBoxQuoteLinesFromPlan(value: unknown): EmptyBoxQuoteLine[] {
  const plan = asRecord(value);
  const rawLines = Array.isArray(plan.boxLines) ? plan.boxLines : [];
  const boxLines = rawLines
    .map((entry) => {
      const line = asRecord(entry);
      const label = String(line.label || "").trim();

      if (!label) {
        return null;
      }

      return {
        label,
        quantity: Math.max(Number(line.quantity) || 1, 1),
      } satisfies EmptyBoxQuoteLine;
    })
    .filter((line): line is EmptyBoxQuoteLine => Boolean(line));

  if (boxLines.length) {
    return boxLines;
  }

  const box = asRecord(plan.box);
  const label = String(box.label || box.name || "").trim();

  if (!label) {
    return [];
  }

  return [
    {
      label,
      quantity: Math.max(Number(plan.boxCount) || 1, 1),
    },
  ];
}

export function emptyBoxStockAlreadyDeducted(plan: Record<string, unknown>) {
  const emptyBox = asRecord(plan.emptyBox);
  return Boolean(emptyBox.stockDeductedAt);
}

export function emptyBoxStockReserved(plan: Record<string, unknown>) {
  const emptyBox = asRecord(plan.emptyBox);
  return Boolean(emptyBox.stockReservedAt);
}

export function shouldReserveEmptyBoxStockOnSale(plan: Record<string, unknown>) {
  if (emptyBoxStockAlreadyDeducted(plan)) {
    return false;
  }

  return readEmptyBoxQuoteLinesFromPlan(plan).length > 0;
}

export function availableEmptyBoxStock(row: Pick<EmptyBoxStockMatchRow, "stock" | "reserved">) {
  return Math.max(0, Number(row.stock) - Number(row.reserved));
}

export function matchEmptyBoxQuoteLinesToStock(
  quoteLines: ReadonlyArray<EmptyBoxQuoteLine>,
  stockRows: ReadonlyArray<EmptyBoxStockMatchRow>,
): MatchedEmptyBoxDeduction[] {
  return quoteLines.map((quote) => {
    const normalizedBox = normalizeInventoryText(quote.label);
    const match = stockRows.find((row) => {
      const item = readInventoryItem(row);

      if (!item) {
        return false;
      }

      return [item.kind, item.name, `Caja ${item.kind}`, `Caja ${item.name}`].some((value) => {
        const normalized = normalizeInventoryText(value || "");
        return normalized.includes(normalizedBox) || normalizedBox.includes(normalized);
      });
    });

    if (!match) {
      throw new Error(`No hay stock registrado para la caja ${quote.label}`);
    }

    const item = readInventoryItem(match);

    if (!item) {
      throw new Error(`No hay stock registrado para la caja ${quote.label}`);
    }

    const quantity = Math.max(Math.floor(Number(quote.quantity) || 1), 1);
    const available = availableEmptyBoxStock(match);

    if (available < quantity) {
      throw new Error(`Stock insuficiente para ${quote.label}`);
    }

    return {
      quote,
      stockId: match.id,
      itemId: item.id,
      itemName: item.name || item.kind,
      quantity,
      available,
    };
  });
}

export function withEmptyBoxStockReservedPlan(
  plan: Record<string, unknown>,
  input: { reservedAt: string; warehouseId: string },
) {
  const emptyBox = asRecord(plan.emptyBox);

  return {
    ...plan,
    emptyBox: {
      ...emptyBox,
      stockReservedAt: input.reservedAt,
      reservationWarehouseId: input.warehouseId,
    },
  };
}

export function withEmptyBoxStockDeductedPlan(
  plan: Record<string, unknown>,
  input: { deductedAt: string; warehouseId: string },
) {
  const emptyBox = asRecord(plan.emptyBox);

  return {
    ...plan,
    emptyBox: {
      ...emptyBox,
      stockDeductedAt: input.deductedAt,
      warehouseId: input.warehouseId,
      stockReservedAt: emptyBox.stockReservedAt || input.deductedAt,
    },
  };
}
