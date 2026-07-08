export type ScheduleTimeKind = "exact" | "range" | "from";

export type ScheduleTimeValue = {
  kind: ScheduleTimeKind;
  start: string;
  end?: string;
};

export function parseScheduleTime(timePart: string): ScheduleTimeValue {
  if (!timePart) {
    return { kind: "exact", start: "" };
  }

  if (timePart.endsWith("+")) {
    return { kind: "from", start: timePart.slice(0, -1) };
  }

  if (timePart.includes("-")) {
    const [start, end] = timePart.split("-");
    return { kind: "range", start: start || "", end: end || "" };
  }

  return { kind: "exact", start: timePart };
}

export function formatScheduleTimePart(value: ScheduleTimeValue): string {
  if (value.kind === "from") {
    return `${value.start}+`;
  }

  if (value.kind === "range" && value.end) {
    return `${value.start}-${value.end}`;
  }

  return value.start;
}

export function formatTime12Hour(value: string) {
  const [hourValue, minuteValue = "00"] = value.split(":");
  const hour = Number(hourValue);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minuteValue} ${period}`;
}

export function formatScheduleTimeLabel(timePart: string) {
  const parsed = parseScheduleTime(timePart);

  if (parsed.kind === "from") {
    return `desde ${formatTime12Hour(parsed.start)}`;
  }

  if (parsed.kind === "range" && parsed.end) {
    return `de ${formatTime12Hour(parsed.start)} a ${formatTime12Hour(parsed.end)}`;
  }

  return `a las ${formatTime12Hour(parsed.start)}`;
}

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatScheduleDateLabel(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return date;
  }

  const [, year, month, day] = match;
  const monthName = MONTH_NAMES_ES[Number(month) - 1];

  if (!monthName) {
    return date;
  }

  return `${Number(day)} de ${monthName} de ${year}`;
}

export function formatScheduleAtDisplay(scheduleAt: string) {
  const [date, timePart] = scheduleAt.split("T");

  if (!date) {
    return scheduleAt;
  }

  const dateLabel = formatScheduleDateLabel(date);

  if (!timePart) {
    return dateLabel;
  }

  return `${dateLabel} ${formatScheduleTimeLabel(timePart)}`;
}

export function scheduleTimeComplete(timePart: string) {
  if (!timePart) {
    return false;
  }

  const parsed = parseScheduleTime(timePart);

  if (parsed.kind === "range") {
    return Boolean(parsed.start && parsed.end);
  }

  return Boolean(parsed.start);
}

export function scheduleAtToTimestamp(scheduleAt: string | null | undefined) {
  if (!scheduleAt) {
    return null;
  }

  const [date, timePart] = scheduleAt.split("T");

  if (
    date &&
    timePart &&
    (timePart.endsWith("+") ||
      /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(timePart) ||
      /^\d{2}:\d{2}$/.test(timePart))
  ) {
    const parsed = parseScheduleTime(timePart);

    if (parsed.start) {
      const timestamp = new Date(`${date}T${parsed.start}`);

      if (!Number.isNaN(timestamp.getTime())) {
        return timestamp.toISOString();
      }
    }
  }

  const fallback = new Date(scheduleAt);

  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }

  return null;
}

export function scheduleTimePresetMatches(
  timePart: string,
  time: string,
  target: "start" | "end" = "start",
) {
  const parsed = parseScheduleTime(timePart);

  if (parsed.kind === "range" && target === "end") {
    return parsed.end === time;
  }

  return parsed.start === time;
}

export function applyScheduleTimePreset(
  timePart: string,
  time: string,
  target: "start" | "end" = "start",
) {
  const parsed = parseScheduleTime(timePart);

  if (parsed.kind === "range" && target === "end") {
    return formatScheduleTimePart({ ...parsed, end: time });
  }

  return formatScheduleTimePart({ ...parsed, start: time });
}
