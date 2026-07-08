export class InvalidQuantityError extends Error {
  constructor(message = "Cantidad invalida") {
    super(message);
    this.name = "InvalidQuantityError";
  }
}

export function readPositiveQty(value: unknown, fallback?: number): number {
  if (value === null || value === undefined || value === "") {
    if (fallback !== undefined && Number.isFinite(fallback) && fallback > 0) {
      return fallback;
    }
    throw new InvalidQuantityError();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || !/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      throw new InvalidQuantityError();
    }
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidQuantityError();
  }

  return parsed;
}

export function readPositiveIntegerQty(value: unknown, fallback?: number): number {
  const qty = readPositiveQty(value, fallback);
  const rounded = Math.floor(qty);

  if (rounded <= 0 || rounded !== qty) {
    throw new InvalidQuantityError("Cantidad debe ser un entero positivo");
  }

  return rounded;
}
