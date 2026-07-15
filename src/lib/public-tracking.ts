import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import { isPaymentMethod, paymentMethodLabel } from "@/lib/payment-methods";
import { readBillingFromPlan } from "@/lib/invoice-billing";

export type PublicTrackingMilestone = {
  id: "created" | "empty_box" | "full_box" | "office" | "departed" | "shipped" | "delivered";
  label: string;
  at: string | null;
  complete: boolean;
};

export type PublicTrackingShipment = {
  code: string;
  status: string;
  sender: { name: string; address: string };
  recipient: { name: string; phone: string; address: string };
  country: string;
  carrier: string;
  boxes: Array<{ label: string; quantity: number }>;
  payment: { total: string; paid: string; balance: string; status: string };
  payments: Array<{ amount: string; method: string; at: string }>;
  milestones: PublicTrackingMilestone[];
  providerTracking: Array<{ code: string; provider: string; number: string; url: string }>;
};

type PublicTrackingSource = {
  code: string;
  customer_name: string;
  country: string;
  carrier: string;
  paid: number | string | null;
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

export function normalizeTrackingCode(value: unknown) {
  return String(value || "").trim().toUpperCase().slice(0, 80);
}

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

function payment(source: PublicTrackingSource) {
  const billing = readBillingFromPlan(source.logistics_plan || {});
  const total = billing ? parseMoneyValue(billing.quotedTotal) : parseMoneyValue(String(source.paid || 0));
  const paid = parseMoneyValue(String(source.paid || 0));
  const balance = Math.max(total - paid, 0);
  return {
    total: formatMoneyValue(total),
    paid: formatMoneyValue(paid),
    balance: formatMoneyValue(balance),
    status: balance > 0 ? "Saldo pendiente" : "Pagado",
  };
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
      name: source.customer_name,
      address: customer.formatted_address || address([
        customer.street, customer.house_number, customer.neighborhood, customer.city, customer.state, customer.postal_code, customer.country,
      ]),
    },
    recipient: {
      name: [text(recipient.firstName), text(recipient.lastName)].filter(Boolean).join(" "),
      phone: text(recipient.phone),
      address: text(recipient.formattedAddress) || address([
        recipient.street, recipient.houseNumber, recipient.neighborhood, recipient.city, recipient.state, recipient.postalCode, recipient.country,
      ]),
    },
    country: source.country,
    carrier: source.carrier,
    boxes: boxes(source.logistics_plan),
    payment: payment(source),
    payments: (source.shipment_payments || []).map((row) => ({
      amount: formatMoneyValue(parseMoneyValue(String(row.amount || 0))),
      method: paymentMethodLabel(isPaymentMethod(row.method) ? row.method : "cash"),
      at: row.created_at,
    })),
    milestones: milestones(source),
    providerTracking: [],
  };
}

export type PublicTrackingLookupRow = PublicTrackingSource;
