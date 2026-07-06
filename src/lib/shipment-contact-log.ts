export const SHIPMENT_CONTACT_CHANNELS = [
  { value: "call", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "other", label: "Otro" },
] as const;

export const SHIPMENT_CONTACT_OUTCOMES = [
  { value: "answered", label: "Contesto" },
  { value: "no_answer", label: "No contesto" },
  { value: "left_message", label: "Mensaje dejado" },
  { value: "call_back", label: "Llamar despues" },
  { value: "wrong_number", label: "Numero mal" },
  { value: "other", label: "Otro" },
] as const;

export type ShipmentContactChannel = (typeof SHIPMENT_CONTACT_CHANNELS)[number]["value"];
export type ShipmentContactOutcome = (typeof SHIPMENT_CONTACT_OUTCOMES)[number]["value"];

export type ShipmentContactLogInput = {
  shipmentId: string;
  channel?: unknown;
  channelOther?: unknown;
  outcome?: unknown;
  note?: unknown;
  nextStep?: unknown;
  followUpAt?: unknown;
};

export type ShipmentContactLogRow = {
  id: string;
  shipmentId: string;
  channel: ShipmentContactChannel;
  channelOther: string;
  outcome: ShipmentContactOutcome;
  note: string;
  nextStep: string;
  followUpAt: string | null;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
};

export type ValidatedShipmentContactLogInput = {
  shipmentId: string;
  channel: ShipmentContactChannel;
  channelOther: string;
  outcome: ShipmentContactOutcome;
  note: string;
  nextStep: string;
  followUpAt: string | null;
};

export type ShipmentContactChannelOtherSummary = {
  label: string;
  count: number;
};

export type ShipmentContactReminderStatus = "none" | "today" | "overdue";

const CONTACT_CHANNEL_VALUES = new Set<string>(
  SHIPMENT_CONTACT_CHANNELS.map((entry) => entry.value),
);
const CONTACT_OUTCOME_VALUES = new Set<string>(
  SHIPMENT_CONTACT_OUTCOMES.map((entry) => entry.value),
);

export function shipmentContactChannelLabel(
  value: ShipmentContactChannel | string,
  channelOther = "",
) {
  if (value === "other") {
    const custom = cleanShipmentContactText(channelOther, 80);
    return custom || "Otro";
  }

  return SHIPMENT_CONTACT_CHANNELS.find((entry) => entry.value === value)?.label || "Otro";
}

export function shipmentContactOutcomeLabel(value: ShipmentContactOutcome | string) {
  return SHIPMENT_CONTACT_OUTCOMES.find((entry) => entry.value === value)?.label || "Otro";
}

export function cleanShipmentContactText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function validateShipmentContactLogInput(input: ShipmentContactLogInput):
  | { ok: true; data: ValidatedShipmentContactLogInput }
  | { ok: false; error: string } {
  const shipmentId = String(input.shipmentId || "").trim();
  const channel = readContactChannel(input.channel);
  const channelOther = cleanShipmentContactText(input.channelOther, 80);
  const outcome = readContactOutcome(input.outcome);
  const note = cleanShipmentContactText(input.note, 2000);
  const nextStep = cleanShipmentContactText(input.nextStep, 240);
  const followUpAt = readFollowUpAt(input.followUpAt);

  if (!shipmentId) {
    return { ok: false, error: "Falta invoice" };
  }

  if (channel === "other" && !channelOther) {
    return { ok: false, error: "Escribe que medio usaste" };
  }

  if (!note) {
    return { ok: false, error: "Escribe que dijo el cliente" };
  }

  if (!followUpAt.ok) {
    return { ok: false, error: followUpAt.error };
  }

  return {
    ok: true,
    data: {
      shipmentId,
      channel,
      channelOther: channel === "other" ? channelOther : "",
      outcome,
      note,
      nextStep,
      followUpAt: followUpAt.value,
    },
  };
}

export function shipmentContactLogAuditDescription(input: ValidatedShipmentContactLogInput) {
  const parts = [
    `${shipmentContactChannelLabel(input.channel, input.channelOther)}: ${shipmentContactOutcomeLabel(input.outcome)}`,
    input.note,
  ];

  if (input.nextStep) {
    parts.push(`Sigue: ${input.nextStep}`);
  }

  return parts.join(" · ");
}

export function shipmentContactLogPreview(
  log: Pick<ShipmentContactLogRow, "channel" | "channelOther" | "note">,
) {
  const firstLine = log.note.split("\n").find(Boolean) || log.note;
  return `${shipmentContactChannelLabel(log.channel, log.channelOther)} · ${firstLine}`;
}

export function summarizeShipmentContactChannelOthers(
  logs: Pick<ShipmentContactLogRow, "channel" | "channelOther">[],
): ShipmentContactChannelOtherSummary[] {
  const counts = new Map<string, number>();

  for (const log of logs) {
    if (log.channel !== "other") {
      continue;
    }

    const label = cleanShipmentContactText(log.channelOther, 80);

    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
}

export function latestShipmentContactLog(logs?: ShipmentContactLogRow[] | null) {
  if (!logs?.length) {
    return null;
  }

  return logs.reduce((latest, log) => {
    const latestTime = Date.parse(latest.createdAt);
    const logTime = Date.parse(log.createdAt);

    if (Number.isNaN(logTime)) {
      return latest;
    }

    if (Number.isNaN(latestTime) || logTime >= latestTime) {
      return log;
    }

    return latest;
  }, logs[0]);
}

export function shipmentContactReminderStatus(
  log: Pick<ShipmentContactLogRow, "followUpAt"> | null | undefined,
  now = new Date(),
): ShipmentContactReminderStatus {
  if (!log?.followUpAt) {
    return "none";
  }

  const followUpAt = new Date(log.followUpAt);

  if (Number.isNaN(followUpAt.getTime())) {
    return "none";
  }

  if (followUpAt.getTime() < now.getTime()) {
    return "overdue";
  }

  return sameLocalDay(followUpAt, now) ? "today" : "none";
}

export function latestShipmentContactReminderStatus(
  logs?: ShipmentContactLogRow[] | null,
  now = new Date(),
) {
  return shipmentContactReminderStatus(latestShipmentContactLog(logs), now);
}

export function shipmentContactReminderLabel(status: ShipmentContactReminderStatus) {
  if (status === "overdue") {
    return "Vencido";
  }

  if (status === "today") {
    return "Hoy";
  }

  return "";
}

function readContactChannel(value: unknown): ShipmentContactChannel {
  const normalized = String(value || "call").trim();
  return CONTACT_CHANNEL_VALUES.has(normalized)
    ? (normalized as ShipmentContactChannel)
    : "call";
}

function readContactOutcome(value: unknown): ShipmentContactOutcome {
  const normalized = String(value || "answered").trim();
  return CONTACT_OUTCOME_VALUES.has(normalized)
    ? (normalized as ShipmentContactOutcome)
    : "answered";
}

function readFollowUpAt(value: unknown):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  const raw = String(value || "").trim();

  if (!raw) {
    return { ok: true, value: null };
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Fecha de seguimiento invalida" };
  }

  return { ok: true, value: date.toISOString() };
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
