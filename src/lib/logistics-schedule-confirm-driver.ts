/** Resolve which driver to use when confirming a logistics schedule. */
export function resolveScheduleConfirmDriverId(input: {
  showDriverPicker: boolean;
  selectedDriverId: string;
  defaultDriverId?: string | null;
  conductors: Array<{ id: string; roleSlug: string }>;
}) {
  if (input.showDriverPicker) {
    return String(input.selectedDriverId || "").trim();
  }

  const fromDefault = String(input.defaultDriverId || "").trim();
  if (fromDefault) {
    return fromDefault;
  }

  return (
    input.conductors.find((member) => member.roleSlug === "conductor")?.id.trim() || ""
  );
}
