type PublicTrackingMilestone = {
  id: "created" | "empty_box" | "full_box" | "office" | "departed" | "shipped" | "delivered";
  label: string;
  at: string | null;
  complete: boolean;
};

export type PublicTrackingShipment = {
  code: string;
  status: string;
  sender: { name: string };
  recipient: { name: string; destination: string };
  country: string;
  carrier: string;
  boxes: Array<{ label: string; quantity: number }>;
  milestones: PublicTrackingMilestone[];
  providerTracking: Array<{ code: string; provider: string; number: string; url: string }>;
};

type PublicTrackingSource = {
  code: string;
  customer_name: string;
  country: string;
  carrier: string;
  status: string;
  created_at: string | null;
  empty_box_delivered_at: string | null;
  full_box_collected_at: string | null;
  office_received_at: string | null;
  departed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  logistics_plan: Record<string, unknown> | null;
  customer:
    | {
        first_name?: string | null;
        last_name?: string | null;
        phones?: string[] | null;
        street?: string | null;
        house_number?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
        country?: string | null;
        formatted_address?: string | null;
      }
    | null;
  recipient_snapshot: Record<string, unknown> | null;
  shipment_payments?: Array<{
    amount: number | string | null;
    method: string | null;
    created_at: string;
  }> | null;
};

export const PUBLIC_TRACKING_ERROR = "No encontramos un envío con esos datos.";

export function lastFourDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

export function senderPhoneMatches(
  customer: PublicTrackingSource["customer"],
  phoneLastFour: string,
) {
  if (!customer || phoneLastFour.length !== 4) return false;
  return (customer.phones || []).some((phone) => lastFourDigits(phone) === phoneLastFour);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return String(value || "").trim();
}

function address(parts: unknown[]) {
  return parts.map(text).filter(Boolean).join(", ");
}

function boxes(planValue: Record<string, unknown> | null) {
  const plan = record(planValue);
  const lines = Array.isArray(plan.boxLines) ? plan.boxLines : [];
  const parsed = lines
    .map((line) => {
      const row = record(line);
      const label = text(row.label);
      return label ? { label, quantity: Math.max(1, Number(row.quantity) || 1) } : null;
    })
    .filter((line): line is { label: string; quantity: number } => Boolean(line));

  if (parsed.length) return parsed;
  const box = record(plan.box);
  const label = text(box.label || box.name);
  return label ? [{ label, quantity: Math.max(1, Number(plan.boxCount) || 1) }] : [];
}

function initials(...values: unknown[]) {
  return values
    .map(text)
    .filter(Boolean)
    .map((value) => `${value.charAt(0).toUpperCase()}.`)
    .join(" ");
}

function milestones(source: PublicTrackingSource): PublicTrackingMilestone[] {
  const all: PublicTrackingMilestone[] = [
    { id: "created", label: "Envío registrado", at: source.created_at, complete: Boolean(source.created_at) },
    { id: "empty_box", label: "Caja vacía entregada", at: source.empty_box_delivered_at, complete: Boolean(source.empty_box_delivered_at) },
    { id: "full_box", label: "Caja llena recibida", at: source.full_box_collected_at, complete: Boolean(source.full_box_collected_at) },
    { id: "office", label: "Recibido en oficina", at: source.office_received_at, complete: Boolean(source.office_received_at) },
    { id: "departed", label: "Salida registrada", at: source.departed_at, complete: Boolean(source.departed_at) },
    { id: "shipped", label: "Enviado", at: source.shipped_at, complete: Boolean(source.shipped_at) },
    { id: "delivered", label: "Entregado", at: source.delivered_at, complete: Boolean(source.delivered_at) },
  ];
  return all.filter((milestone) => milestone.id === "created" || milestone.complete || milestone.id === "delivered");
}

export function publicTrackingShipment(source: PublicTrackingSource): PublicTrackingShipment {
  const recipient = record(source.recipient_snapshot);
  const customer = source.customer || {};
  return {
    code: source.code,
    status: source.status,
    sender: {
      name: initials(customer.first_name, customer.last_name) || "Cliente verificado",
    },
    recipient: {
      name: initials(recipient.firstName, recipient.lastName) || "Destinatario",
      destination: address([recipient.city, recipient.state, recipient.country || source.country]),
    },
    country: source.country,
    carrier: source.carrier,
    boxes: boxes(source.logistics_plan),
    milestones: milestones(source),
    providerTracking: [],
  };
}

export type PublicTrackingLookupRow = PublicTrackingSource;
