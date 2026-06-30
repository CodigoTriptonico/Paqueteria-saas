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
