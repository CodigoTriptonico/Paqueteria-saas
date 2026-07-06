type NativePickerTarget = {
  showPicker: () => void;
};

export type NativePickerControl = Partial<NativePickerTarget> | null | undefined;

export function hasNativePicker(input: NativePickerControl): input is NativePickerTarget {
  return typeof input?.showPicker === "function";
}

export function openNativePicker(input: NativePickerControl) {
  if (!hasNativePicker(input)) {
    return false;
  }

  try {
    input.showPicker();
    return true;
  } catch {
    return false;
  }
}

function isDomNode(value: unknown): value is Node {
  return (
    value !== null &&
    typeof value === "object" &&
    "nodeType" in value &&
    typeof (value as Node).nodeType === "number"
  );
}

export function isNativeDateTimeInput(
  element: Element | null | undefined,
): element is HTMLInputElement {
  return (
    element != null &&
    "tagName" in element &&
    String((element as HTMLElement).tagName).toUpperCase() === "INPUT" &&
    ((element as HTMLInputElement).type === "date" ||
      (element as HTMLInputElement).type === "time")
  );
}

/**
 * Returns true when a pointerdown outside `container` should not dismiss overlays,
 * because the user is clicking the browser's native date/time picker popup.
 */
export function shouldSuppressDismissForNativePicker(
  event: Pick<PointerEvent, "target">,
  container: Node | null | undefined,
  activeElement: Element | null = typeof document !== "undefined"
    ? document.activeElement
    : null,
): boolean {
  const target = event.target;
  if (!isDomNode(target)) {
    return false;
  }

  if (container?.contains(target)) {
    return false;
  }

  return isNativeDateTimeInput(activeElement);
}
