import type { ActivityHistoryRow } from "@/app/actions/history";
import type { ShipmentProgressStep } from "@/lib/shipment-display";
import { milestoneKeyForProgressKind, SHIPMENT_MILESTONE_ACTION } from "@/lib/shipment-milestones";
import { formatShipmentAbsolute, formatShipmentDuration, formatShipmentRelative } from "@/lib/shipment-timing";
import {
  scheduleHistoryDetailFromMetadata,
  SHIPMENT_SCHEDULE_UPDATED_ACTION,
} from "@/lib/shipment-schedule-history";

const ISO_IN_TEXT =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;

function metaText(row: ActivityHistoryRow, key: string) {
  const value = row.metadata?.[key];
  return typeof value === "string" ? value : "";
}

export function sanitizeHistoryIsoText(text: string) {
  return text.replace(ISO_IN_TEXT, (iso) => formatShipmentAbsolute(iso) || iso);
}

export function stepHistoryEntryTitle(entry: ActivityHistoryRow) {
  if (entry.action === SHIPMENT_MILESTONE_ACTION) {
    return metaText(entry, "milestoneLabel") || entry.title.split(" · ")[0] || entry.title;
  }

  if (entry.action === "shipment.logistics_plan_updated") {
    return "Cambio de logística";
  }

  if (entry.action === SHIPMENT_SCHEDULE_UPDATED_ACTION) {
    return "Cambio de fecha";
  }

  if (entry.action === "shipment.logistics_task_ordered") {
    return "Orden en envíos";
  }

  if (entry.action === "shipment.status_updated") {
    return entry.title || "Cambio de estado";
  }

  if (entry.action === "sale.open_invoice_created" || entry.action === "sale.created") {
    return "Venta registrada";
  }

  return entry.title;
}

export function stepHistoryEntryDetail(entry: ActivityHistoryRow) {
  if (entry.action === SHIPMENT_SCHEDULE_UPDATED_ACTION) {
    const detail = scheduleHistoryDetailFromMetadata(entry.metadata || {});

    if (detail) {
      return detail;
    }
  }

  if (entry.action === "shipment.logistics_task_updated") {
    const orderedAt = metaText(entry, "orderedAt");
    const completedAt = metaText(entry, "completedAt");
    const status = metaText(entry, "status");

    if (status === "completed" && orderedAt && completedAt) {
      const elapsedMs = Date.parse(completedAt) - Date.parse(orderedAt);

      if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
        return `Completada ${formatShipmentDuration(elapsedMs)} después de ordenarse en envíos`;
      }
    }

    const assignedAt = metaText(entry, "assignedAt");
    const loadedAt = metaText(entry, "loadedAt");

    if (status === "assigned" && orderedAt && assignedAt) {
      const elapsedMs = Date.parse(assignedAt) - Date.parse(orderedAt);

      if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
        return `Asignada ${formatShipmentDuration(elapsedMs)} después de ordenarse en envíos`;
      }
    }

    if (status === "loaded_to_truck" && orderedAt && loadedAt) {
      const elapsedMs = Date.parse(loadedAt) - Date.parse(orderedAt);

      if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
        return `Cargada ${formatShipmentDuration(elapsedMs)} después de ordenarse en envíos`;
      }
    }
  }

  if (entry.action === SHIPMENT_MILESTONE_ACTION) {
    const source = metaText(entry, "source");

    if (source === "counter_handoff") {
      return "Entregada en mostrador";
    }

    if (source === "logistics_task") {
      return "Completada en logística";
    }

    const nextStatus = metaText(entry, "nextStatus");
    if (nextStatus) {
      return `Estado marcado: ${nextStatus}`;
    }

    const interaction = metaText(entry, "interaction");
    if (interaction === "context_menu") {
      return "Desde menú de pasos";
    }

    if (entry.description) {
      const sanitized = sanitizeHistoryIsoText(entry.description.trim());
      const withoutLabel = sanitized.replace(/^[^·]+registrado ·\s*/i, "").trim();
      if (withoutLabel && withoutLabel !== sanitized) {
        return `Registrado ${withoutLabel}`;
      }
    }

    return "";
  }

  if (!entry.description?.trim()) {
    return "";
  }

  const title = stepHistoryEntryTitle(entry);
  const description = sanitizeHistoryIsoText(entry.description.trim());

  if (description === title) {
    return "";
  }

  if (/ registrado · /i.test(description) && description.startsWith(title)) {
    return "";
  }

  if (entry.action === SHIPMENT_MILESTONE_ACTION && /registrado ·/i.test(description)) {
    return "";
  }

  return description;
}

export function stepDetailPhrase(detail: string) {
  const trimmed = detail.trim();

  if (!trimmed) {
    return "";
  }

  const lower = `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;

  return lower.replace(/\ben oficina\b/i, "en la oficina");
}

export function buildStepSummarySentence(input: {
  step: ShipmentProgressStep;
  completedAt?: string | null;
  waitText?: string;
  actorName?: string;
}) {
  const { step, completedAt, waitText, actorName } = input;
  const who = actorName?.trim();
  const when = completedAt ? formatShipmentRelative(completedAt) : "";
  const what = stepDetailPhrase(step.detail) || step.title.toLowerCase();

  if (step.state === "active") {
    if (waitText) {
      return `${what} · ${waitText}`;
    }

    return `${what} · en curso`;
  }

  const parts = [what];

  if (who) {
    parts.push(`por ${who}`);
  }

  if (when) {
    parts.push(when);
  }

  return parts.join(" ");
}

export function primaryStepHistoryEntry(
  matchingHistory: ActivityHistoryRow[],
  step: ShipmentProgressStep,
) {
  if (!matchingHistory.length) {
    return null;
  }

  const milestoneKey = milestoneKeyForProgressKind(step.kind);

  if (milestoneKey) {
    const milestoneEntry = matchingHistory.find(
      (entry) =>
        entry.action === SHIPMENT_MILESTONE_ACTION && metaText(entry, "milestone") === milestoneKey,
    );

    if (milestoneEntry) {
      return milestoneEntry;
    }
  }

  return matchingHistory[0] || null;
}

export function supplementaryStepHistory(
  matchingHistory: ActivityHistoryRow[],
  step: ShipmentProgressStep,
) {
  const primary = primaryStepHistoryEntry(matchingHistory, step);

  if (!primary) {
    return matchingHistory;
  }

  return matchingHistory.filter((entry) => entry.id !== primary.id);
}

export function stepHistoryTimestamp(entry: ActivityHistoryRow) {
  const relative = formatShipmentRelative(entry.createdAt);
  const absolute = formatShipmentAbsolute(entry.createdAt);

  if (relative && absolute) {
    return { relative, absolute };
  }

  return { relative: relative || absolute, absolute: "" };
}

const SALE_HISTORY_ACTIONS = new Set([
  "sale.open_invoice_created",
  "sale.created",
  "sale.empty_box_deposit",
]);

function historyTimesNear(left: string, right: string, windowMs = 5000) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return false;
  }

  return Math.abs(leftMs - rightMs) <= windowMs;
}

function milestoneCoveredBySale(saleEntry: ActivityHistoryRow, milestoneEntry: ActivityHistoryRow) {
  if (milestoneEntry.action !== SHIPMENT_MILESTONE_ACTION) {
    return false;
  }

  if (!SALE_HISTORY_ACTIONS.has(saleEntry.action)) {
    return false;
  }

  if (!historyTimesNear(saleEntry.createdAt, milestoneEntry.createdAt)) {
    return false;
  }

  const saleText = `${saleEntry.title} ${saleEntry.description}`.toLowerCase();
  const milestone = metaText(milestoneEntry, "milestone");

  if (milestone === "empty_box_delivered_at") {
    return /caja vac[ií]a entregada|entregada en mostrador/.test(saleText);
  }

  if (milestone === "full_box_collected_at") {
    return /caja llena/.test(saleText) && /recogida|recolecci[oó]n/.test(saleText);
  }

  const milestoneLabel = metaText(milestoneEntry, "milestoneLabel").toLowerCase();
  return milestoneLabel ? saleText.includes(milestoneLabel.slice(0, 12)) : false;
}

export function consolidateShipmentActivityHistory(rows: ActivityHistoryRow[]) {
  const hiddenIds = new Set<string>();

  for (const milestoneEntry of rows) {
    if (milestoneEntry.action !== SHIPMENT_MILESTONE_ACTION) {
      continue;
    }

    const covered = rows.some(
      (candidate) => candidate.id !== milestoneEntry.id && milestoneCoveredBySale(candidate, milestoneEntry),
    );

    if (covered) {
      hiddenIds.add(milestoneEntry.id);
    }
  }

  return rows.filter((row) => !hiddenIds.has(row.id));
}

function parseSaleLogisticsDescription(description: string) {
  const sanitized = sanitizeHistoryIsoText(description.trim());
  const [customerPart = "", logisticsPart = ""] = sanitized.split("·").map((part) => part.trim());

  let emptyBox = "";
  let fullBox = "";

  for (const part of logisticsPart.split("|")) {
    const trimmed = part.trim();

    if (/^Caja vac[ií]a:/i.test(trimmed)) {
      emptyBox = trimmed.replace(/^Caja vac[ií]a:\s*/i, "").trim();
    } else if (/^Caja llena:/i.test(trimmed)) {
      fullBox = trimmed.replace(/^Caja llena:\s*/i, "").trim();
    }
  }

  return {
    customer: customerPart,
    emptyBox,
    fullBox,
  };
}

function isFutureLogisticsStatus(text: string) {
  return /pendiente|sin fecha|programar|falta elegir|luego/i.test(text);
}

function normalizeLogisticsPhrase(text: string) {
  return text
    .replace(/^caja vac[ií]a\s+/i, "")
    .replace(/\ben mostrador\b/i, "en la oficina")
    .replace(/\ben oficina\b/i, "en la oficina")
    .trim();
}

function saleHistoryMoment(description: string) {
  const { emptyBox } = parseSaleLogisticsDescription(description);

  if (!emptyBox || isFutureLogisticsStatus(emptyBox)) {
    return "";
  }

  return stepDetailPhrase(normalizeLogisticsPhrase(emptyBox));
}

function invoiceCodeFromTitle(title: string) {
  return title.match(/INV-[\w-]+/i)?.[0] || "";
}

function saleAuditKindLabel(action: string) {
  if (action === "sale.open_invoice_created") {
    return "Registro creado";
  }

  if (action === "sale.empty_box_deposit") {
    return "Depósito registrado";
  }

  return "Venta registrada";
}

export function formatAuditHistoryTitle(entry: ActivityHistoryRow) {
  if (entry.action === "sale.open_invoice_created") {
    const invoice = invoiceCodeFromTitle(entry.title);
    return invoice || "Invoice abierto";
  }

  if (entry.action === "sale.empty_box_deposit") {
    const invoice = invoiceCodeFromTitle(entry.title);
    return invoice || "Depósito caja vacía";
  }

  if (entry.action === "sale.created") {
    const invoice = invoiceCodeFromTitle(entry.title);
    return invoice || "Venta registrada";
  }

  if (entry.action === SHIPMENT_MILESTONE_ACTION) {
    return stepHistoryEntryTitle(entry);
  }

  return entry.title;
}

export function formatAuditHistoryHeaderLabel(entry: ActivityHistoryRow, actionLabel: string) {
  const invoice = invoiceCodeFromTitle(entry.title);

  if (invoice) {
    return invoice;
  }

  if (SALE_HISTORY_ACTIONS.has(entry.action)) {
    return formatAuditHistoryTitle(entry);
  }

  return actionLabel;
}

export function formatAuditHistoryDetail(entry: ActivityHistoryRow) {
  if (entry.action === SHIPMENT_MILESTONE_ACTION) {
    return stepHistoryEntryDetail(entry);
  }

  if (entry.action === SHIPMENT_SCHEDULE_UPDATED_ACTION) {
    return scheduleHistoryDetailFromMetadata(entry.metadata || {}) || stepHistoryEntryDetail(entry);
  }

  if (SALE_HISTORY_ACTIONS.has(entry.action)) {
    const moment = entry.description ? saleHistoryMoment(entry.description) : "";
    return moment;
  }

  if (!entry.description?.trim()) {
    return "";
  }

  return sanitizeHistoryIsoText(entry.description.trim());
}

export type AuditHistoryLineSegment =
  | { type: "text"; value: string }
  | { type: "date"; value: string }
  | { type: "invoice"; value: string }
  | { type: "moment"; value: string }
  | { type: "actor"; value: string };

function compactShipmentAuditDetail(description: string) {
  return description
    .replace(/^Menú contextual\s*-\s*/i, "")
    .replace(/^Clic izquierdo en tarjeta\s*-\s*/i, "")
    .replace(/^Clic derecho en tarjeta\s*-\s*/i, "")
    .trim();
}

function shipmentAuditDetailSegments(detail: string): AuditHistoryLineSegment[] {
  const compact = compactShipmentAuditDetail(detail);
  const parts = compact.split(" · ").map((part) => part.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return [{ type: "text", value: compact }];
  }

  const segments: AuditHistoryLineSegment[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (index > 0) {
      segments.push({ type: "text", value: "·" });
    }

    const scheduled = part.match(/^(Ordenada|Programada para)\s+(.+)$/i);
    if (scheduled) {
      segments.push({ type: "text", value: scheduled[1] });
      segments.push({ type: "date", value: scheduled[2] });
      continue;
    }

    const scheduleChange = part.match(/^(.+?)\s+→\s+(.+)$/);
    if (scheduleChange) {
      segments.push({ type: "date", value: scheduleChange[1] });
      segments.push({ type: "text", value: "→" });
      segments.push({ type: "date", value: scheduleChange[2] });
      continue;
    }

    const step = part.match(/^Paso:\s*(.+)$/i);
    if (step) {
      segments.push({ type: "text", value: "Paso:" });
      segments.push({ type: "moment", value: step[1] });
      continue;
    }

    segments.push({ type: "text", value: part });
  }

  return segments;
}

export function buildAuditHistorySegments(entry: ActivityHistoryRow | null | undefined): AuditHistoryLineSegment[] {
  if (!entry) {
    return [];
  }

  const who = entry.actorName?.trim();

  if (SALE_HISTORY_ACTIONS.has(entry.action)) {
    const absolute = formatShipmentAbsolute(entry.createdAt);
    const moment = entry.description ? saleHistoryMoment(entry.description) : "";
    const segments: AuditHistoryLineSegment[] = [
      { type: "text", value: saleAuditKindLabel(entry.action) },
    ];

    if (absolute) {
      segments.push({ type: "date", value: absolute });
    }

    if (moment) {
      segments.push({ type: "moment", value: moment });
    }

    if (who) {
      segments.push({ type: "text", value: "vendedor encargado" });
      segments.push({ type: "actor", value: who });
    }

    return segments;
  }

  const detail = formatAuditHistoryDetail(entry);
  const title = formatAuditHistoryTitle(entry);
  const segments: AuditHistoryLineSegment[] = detail
    ? shipmentAuditDetailSegments(detail)
    : [{ type: "text", value: title }];

  if (who) {
    segments.push({ type: "text", value: "por" });
    segments.push({ type: "actor", value: who });
  }

  return segments;
}

function auditSegmentPlainText(segment: AuditHistoryLineSegment) {
  return segment.value;
}

export function formatAuditHistoryLine(entry: ActivityHistoryRow) {
  const segments = buildAuditHistorySegments(entry);
  const parts: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];

    if (segment.type === "text" && next?.type === "date") {
      parts.push(`${segment.value} ${next.value}`);
      index += 1;
      continue;
    }

    if (segment.type === "text" && segment.value === "vendedor encargado" && next?.type === "actor") {
      parts.push(`vendedor encargado ${next.value}`);
      index += 1;
      continue;
    }

    if (segment.type === "text" && segment.value === "por" && next?.type === "actor") {
      parts.push(`por ${next.value}`);
      index += 1;
      continue;
    }

    parts.push(auditSegmentPlainText(segment));
  }

  return parts.join(" · ");
}
