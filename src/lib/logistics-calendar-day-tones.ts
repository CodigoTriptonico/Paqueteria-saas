import { scheduledAtToLocalDateInput } from "@/lib/schedule-date";

/** Operational day markers for the logistics date filter calendar. */
export type LogisticsCalendarDayTone = "pending" | "ready" | "assigned" | "attention";

const TONE_RANK: Record<LogisticsCalendarDayTone, number> = {
  attention: 4,
  pending: 3,
  ready: 2,
  assigned: 1,
};

export const logisticsCalendarDayToneLegend: ReadonlyArray<{
  tone: LogisticsCalendarDayTone;
  label: string;
}> = [
  { tone: "pending", label: "Pendiente" },
  { tone: "ready", label: "Listo" },
  { tone: "assigned", label: "Asignado" },
  { tone: "attention", label: "Atención" },
];

/**
 * Maps a single logistics task to a calendar tone.
 * Completed tasks are omitted so finished work does not crowd the grid.
 */
export function resolveLogisticsTaskCalendarTone(task: {
  status: string;
  assignedTo?: string | null;
}): LogisticsCalendarDayTone | null {
  const status = String(task.status || "").trim();
  if (status === "completed") {
    return null;
  }
  if (status === "cancelled") {
    return "attention";
  }
  if (status === "pending") {
    return "pending";
  }
  if (status === "scheduled") {
    return String(task.assignedTo || "").trim() ? "assigned" : "ready";
  }
  if (status === "assigned" || status === "loaded_to_truck") {
    return "assigned";
  }
  return "pending";
}

export function mergeLogisticsCalendarDayTone(
  current: LogisticsCalendarDayTone | null | undefined,
  next: LogisticsCalendarDayTone,
): LogisticsCalendarDayTone {
  if (!current) {
    return next;
  }
  return TONE_RANK[next] > TONE_RANK[current] ? next : current;
}

/** Aggregates task statuses into one tone per local calendar date (YYYY-MM-DD). */
export function buildLogisticsCalendarDayTones(
  tasks: ReadonlyArray<{
    scheduledAt?: string | null;
    status: string;
    assignedTo?: string | null;
  }>,
): Record<string, LogisticsCalendarDayTone> {
  const tones: Record<string, LogisticsCalendarDayTone> = {};

  for (const task of tasks) {
    const date = scheduledAtToLocalDateInput(task.scheduledAt || null);
    if (!date) {
      continue;
    }
    const tone = resolveLogisticsTaskCalendarTone(task);
    if (!tone) {
      continue;
    }
    tones[date] = mergeLogisticsCalendarDayTone(tones[date], tone);
  }

  return tones;
}

/** Cell classes when the day is selectable and not the selected value. */
export function logisticsCalendarDayToneClass(tone: LogisticsCalendarDayTone | null | undefined) {
  switch (tone) {
    case "pending":
      return "border border-amber-600/70 bg-amber-400/25 text-amber-50 hover:bg-amber-400/35";
    case "ready":
      return "border border-sky-600/70 bg-sky-400/22 text-sky-50 hover:bg-sky-400/32";
    case "assigned":
      return "border border-emerald-600/70 bg-emerald-400/22 text-emerald-50 hover:bg-emerald-400/32";
    case "attention":
      return "border border-rose-600/70 bg-rose-500/25 text-rose-50 hover:bg-rose-500/35";
    default:
      return "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover";
  }
}

export function logisticsCalendarDayToneDotClass(tone: LogisticsCalendarDayTone) {
  switch (tone) {
    case "pending":
      return "bg-amber-400";
    case "ready":
      return "bg-sky-400";
    case "assigned":
      return "bg-emerald-400";
    case "attention":
      return "bg-rose-400";
  }
}
