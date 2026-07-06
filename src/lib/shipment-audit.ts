import { formatShipmentAbsolute } from "@/lib/shipment-timing";

export type ShipmentAuditInteraction =
  | "left_click"
  | "right_click"
  | "context_menu"
  | "schedule_due";

export type ShipmentAuditContext = {
  interaction: ShipmentAuditInteraction;
  source?: string;
  stepTitle?: string;
  stepKind?: string;
};

export function shipmentAuditInteractionLabel(interaction: ShipmentAuditInteraction) {
  if (interaction === "left_click") {
    return "Clic izquierdo en tarjeta";
  }

  if (interaction === "right_click") {
    return "Clic derecho en tarjeta";
  }

  if (interaction === "schedule_due") {
    return "Fecha programada cumplida";
  }

  return "Menú contextual";
}

export function logisticsLegSnapshot(plan: Record<string, unknown>, key: "emptyBox" | "fullBox") {
  const leg = plan[key];

  if (!leg || typeof leg !== "object" || Array.isArray(leg)) {
    return null;
  }

  const row = leg as Record<string, unknown>;

  return {
    mode: String(row.mode || ""),
    handingNow: row.handingNow === true,
    scheduleMode: String(row.scheduleMode || ""),
    scheduleAt: String(row.scheduleAt || ""),
  };
}

export function describeLogisticsAuditChange(input: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  interaction: ShipmentAuditInteraction;
  stepTitle?: string;
}) {
  const emptyBefore = logisticsLegSnapshot(input.before, "emptyBox");
  const emptyAfter = logisticsLegSnapshot(input.after, "emptyBox");
  const fullBefore = logisticsLegSnapshot(input.before, "fullBox");
  const fullAfter = logisticsLegSnapshot(input.after, "fullBox");

  const chunks: string[] = [shipmentAuditInteractionLabel(input.interaction)];

  if (input.stepTitle) {
    chunks.push(`Paso: ${input.stepTitle}`);
  }

  if (emptyBefore && emptyAfter && JSON.stringify(emptyBefore) !== JSON.stringify(emptyAfter)) {
    chunks.push(`Caja vacía: ${legModeLabel(emptyBefore)} → ${legModeLabel(emptyAfter)}`);
  }

  if (fullBefore && fullAfter && JSON.stringify(fullBefore) !== JSON.stringify(fullAfter)) {
    chunks.push(`Caja llena: ${legModeLabel(fullBefore)} → ${legModeLabel(fullAfter)}`);
  }

  return chunks.join(" · ");
}

export function logisticsTaskTypeLabel(
  taskType: "deliver_empty_box" | "pickup_full_box",
) {
  return taskType === "deliver_empty_box" ? "Entrega de caja vacía" : "Recolección de caja llena";
}

export function describeLogisticsTaskOrdered(input: {
  taskType: "deliver_empty_box" | "pickup_full_box";
  orderedAt: string;
  scheduleMode: string;
  scheduleAt: string | null;
  interaction: ShipmentAuditInteraction;
  stepTitle?: string;
}) {
  const chunks = [
    shipmentAuditInteractionLabel(input.interaction),
    logisticsTaskTypeLabel(input.taskType),
    `Ordenada ${formatShipmentAbsolute(input.orderedAt)}`,
  ];

  if (input.stepTitle) {
    chunks.push(`Paso: ${input.stepTitle}`);
  }

  if (input.scheduleMode === "scheduled" && input.scheduleAt) {
    const scheduled = formatShipmentAbsolute(input.scheduleAt);
    if (scheduled) {
      chunks.push(`Programada para ${scheduled}`);
    }
  }

  return chunks.join(" · ");
}

function legModeLabel(leg: NonNullable<ReturnType<typeof logisticsLegSnapshot>>) {
  const mode = leg.mode;

  if (mode.includes("mostrador") || (leg.handingNow && mode.includes("oficina"))) {
    return "Mostrador";
  }

  if (mode.includes("oficina") || mode.includes("recoge") || mode.includes("trae")) {
    return "Oficina";
  }

  if (mode.includes("Programar")) {
    if (leg.scheduleMode === "scheduled" && leg.scheduleAt) {
      const formatted = formatShipmentAbsolute(leg.scheduleAt);
      return formatted ? `Domicilio (${formatted})` : "Domicilio (programado)";
    }

    return "Domicilio (sin fecha)";
  }

  return mode || "Sin definir";
}

export function describeStatusAuditChange(input: {
  previousStatus: string;
  nextStatus: string;
  interaction: ShipmentAuditInteraction;
  stepTitle?: string;
}) {
  const chunks = [
    shipmentAuditInteractionLabel(input.interaction),
    `${input.previousStatus} → ${input.nextStatus}`,
  ];

  if (input.stepTitle) {
    chunks.push(`Paso: ${input.stepTitle}`);
  }

  return chunks.join(" · ");
}

export function shipmentAuditActionLabel(action: string) {
  if (action === "shipment.status_updated") {
    return "Estado del envío";
  }

  if (action === "shipment.milestone_recorded") {
    return "Hito del envío";
  }

  if (action === "shipment.logistics_plan_updated") {
    return "Logística";
  }

  if (action === "shipment.schedule_updated") {
    return "Cambio de fecha";
  }

  if (action === "shipment.logistics_task_ordered") {
    return "Orden en envíos";
  }

  if (action === "shipment.logistics_task_updated") {
    return "Tarea logística";
  }

  if (action === "shipment.logistics_task_failed") {
    return "Visita fallida";
  }

  if (action === "sale.invoice_finalized") {
    return "Cierre de invoice";
  }

  if (action === "sale.invoice_partial_payment") {
    return "Abono";
  }

  if (action === "sale.invoice_priority_updated") {
    return "Prioridad";
  }

  if (action === "sale.created") {
    return "Venta";
  }

  if (action === "shipment.sales_owner_updated") {
    return "Vendedor";
  }

  if (action === "sale.open_invoice_created") {
    return "Venta";
  }

  return action.replace(/^[^.]+\./, "").replaceAll("_", " ");
}
