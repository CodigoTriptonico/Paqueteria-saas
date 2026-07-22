export type QuickBoxSelection = {
  boxKey: string;
  quantity: number;
};

export function nextQuickBoxSelection(
  current: QuickBoxSelection,
  boxKey: string,
  action: "add" | "remove",
): QuickBoxSelection {
  if (action === "add") {
    return current.boxKey === boxKey
      ? { boxKey, quantity: current.quantity + 1 }
      : { boxKey, quantity: 1 };
  }

  if (current.boxKey !== boxKey) {
    return current;
  }

  if (current.quantity <= 1) {
    return { boxKey: "", quantity: 0 };
  }

  return { boxKey, quantity: current.quantity - 1 };
}
