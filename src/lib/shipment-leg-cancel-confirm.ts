export function logisticsLegCancelCopy(cancelLabel: string, legShort: string) {
  return {
    title: `¿${cancelLabel}?`,
    message: `Se quita el aviso a logística para ${legShort.toLowerCase()}. La tarea pendiente se cancela y tendrás que marcarla de nuevo cuando corresponda.`,
    confirmLabel: cancelLabel,
    tone: "danger" as const,
  };
}
