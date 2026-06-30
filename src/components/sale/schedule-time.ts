export type ScheduleTimeKind = "exact" | "range" | "from";

export type ScheduleTimeValue = {
  kind: ScheduleTimeKind;
  start: string;
  end?: string;
};

export function parseScheduleTime(timePart: string): ScheduleTimeValue {
  if (!timePart) {
    return { kind: "exact", start: "10:00" };
  }

  if (timePart.endsWith("+")) {
    return { kind: "from", start: timePart.slice(0, -1) || "10:00" };
  }

  if (timePart.includes("-")) {
    const [start, end] = timePart.split("-");
    return { kind: "range", start: start || "10:00", end: end || "" };
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

export function formatScheduleAtDisplay(scheduleAt: string) {
  const [date, timePart] = scheduleAt.split("T");

  if (!date) {
    return scheduleAt;
  }

  if (!timePart) {
    return date;
  }

  return `${date} ${formatScheduleTimeLabel(timePart)}`;
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

export function scheduleTimePresetMatches(timePart: string, time: string) {
  return parseScheduleTime(timePart).kind === "exact" && parseScheduleTime(timePart).start === time;
}
