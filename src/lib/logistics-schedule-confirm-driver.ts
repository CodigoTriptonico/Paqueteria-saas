/** Resolve which driver to use when confirming a logistics schedule. Driver is optional. */
export function resolveScheduleConfirmDriverId(input: {
  showDriverPicker: boolean;
  selectedDriverId: string;
  defaultDriverId?: string | null;
  /** Kept for callers; no longer used as an auto-fallback. */
  conductors?: Array<{ id: string; roleSlug: string }>;
}) {
  if (input.showDriverPicker) {
    return String(input.selectedDriverId || "").trim();
  }

  // Sellers don't pick a driver; use weekday default if set, otherwise leave empty.
  return String(input.defaultDriverId || "").trim();
}
