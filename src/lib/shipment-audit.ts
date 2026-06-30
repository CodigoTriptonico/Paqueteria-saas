export type ShipmentAuditInteraction = "left_click" | "right_click" | "context_menu";

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
      return `Domicilio (${leg.scheduleAt})`;
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

  if (action === "sale.invoice_finalized") {
    return "Cierre de invoice";
  }

  if (action === "sale.open_invoice_created") {
    return "Venta / invoice";
  }

  return action;
}
