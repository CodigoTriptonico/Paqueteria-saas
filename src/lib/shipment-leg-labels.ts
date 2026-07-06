export const EMPTY_BOX_LEG_LABELS = {
  short: "Dejar",
  ready: "Listo para dejar",
  cancel: "No dejar",
  setDate: "Establecer una fecha",
  scheduleAria: "Fecha para dejar",
  auditStep: "Dejar",
} as const;

export const FULL_BOX_LEG_LABELS = {
  short: "Recoger",
  ready: "Listo para recoger",
  cancel: "No recoger",
  setDate: "Establecer una fecha",
  scheduleAria: "Fecha para recoger",
  auditStep: "Recoger",
} as const;

export function shipmentLegLabels(kind: "empty_box" | "full_box") {
  return kind === "empty_box" ? EMPTY_BOX_LEG_LABELS : FULL_BOX_LEG_LABELS;
}
