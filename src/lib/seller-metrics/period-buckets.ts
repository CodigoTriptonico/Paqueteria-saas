export type PeriodGranularity = "day" | "week" | "month" | "range";

export type PeriodRangeKeys = {
  from: string;
  to: string;
};

function cloneDate(value: Date) {
  return new Date(value.getTime());
}

export function normalizeAnchorDate(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();
  date.setHours(12, 0, 0, 0);
  return date;
}

function startOfDay(value: Date) {
  const date = cloneDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = cloneDate(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(date, mondayOffset);
}

function startOfMonth(value: Date) {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

export function dateFromDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function normalizeRangeKeys(fromKey: string, toKey: string): PeriodRangeKeys {
  const fromDate = dateFromDayKey(fromKey);
  const toDate = dateFromDayKey(toKey);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error("INVALID_RANGE");
  }

  if (fromDate.getTime() <= toDate.getTime()) {
    return { from: dayKeyFromDate(fromDate), to: dayKeyFromDate(toDate) };
  }

  return { from: dayKeyFromDate(toDate), to: dayKeyFromDate(fromDate) };
}

export function defaultRangeKeys(anchor: Date = new Date()) {
  const normalized = normalizeAnchorDate(anchor);
  const weekStart = startOfWeek(normalized);
  return {
    from: dayKeyFromDate(weekStart),
    to: dayKeyFromDate(normalized),
  };
}

export function rangePeriodBounds(fromKey: string, toKey: string) {
  const range = normalizeRangeKeys(fromKey, toKey);
  const start = startOfDay(dateFromDayKey(range.from));
  const end = addDays(startOfDay(dateFromDayKey(range.to)), 1);
  return { start, end, range };
}

export function rangePeriodLabel(fromKey: string, toKey: string) {
  const range = normalizeRangeKeys(fromKey, toKey);
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (range.from === range.to) {
    return formatter.format(dateFromDayKey(range.from));
  }

  return `${formatter.format(dateFromDayKey(range.from))} – ${formatter.format(dateFromDayKey(range.to))}`;
}

export function periodBounds(
  anchor: Date,
  granularity: PeriodGranularity,
  range?: PeriodRangeKeys | null,
) {
  if (granularity === "range") {
    if (!range?.from || !range?.to) {
      const fallback = defaultRangeKeys(anchor);
      return rangePeriodBounds(fallback.from, fallback.to);
    }

    return rangePeriodBounds(range.from, range.to);
  }

  const normalized = normalizeAnchorDate(anchor);

  if (granularity === "day") {
    const start = startOfDay(normalized);
    return { start, end: addDays(start, 1) };
  }

  if (granularity === "week") {
    const start = startOfWeek(normalized);
    return { start, end: addDays(start, 7) };
  }

  const start = startOfMonth(normalized);
  const end = startOfMonth(addDays(start, 32));
  end.setDate(1);
  return { start, end };
}

export function shiftAnchor(
  anchor: Date,
  granularity: PeriodGranularity,
  delta: -1 | 1,
) {
  if (granularity === "range") {
    return normalizeAnchorDate(anchor);
  }

  const normalized = normalizeAnchorDate(anchor);

  if (granularity === "day") {
    return addDays(normalized, delta);
  }

  if (granularity === "week") {
    return addDays(normalized, delta * 7);
  }

  const day = normalized.getDate();
  const next = new Date(
    normalized.getFullYear(),
    normalized.getMonth() + delta,
    day,
    12,
    0,
    0,
    0,
  );
  return next;
}

export function periodLabel(
  anchor: Date,
  granularity: PeriodGranularity,
  range?: PeriodRangeKeys | null,
) {
  if (granularity === "range") {
    if (!range?.from || !range?.to) {
      const fallback = defaultRangeKeys(anchor);
      return rangePeriodLabel(fallback.from, fallback.to);
    }

    return rangePeriodLabel(range.from, range.to);
  }

  const normalized = normalizeAnchorDate(anchor);
  const { start, end } = periodBounds(normalized, granularity);
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (granularity === "day") {
    return formatter.format(start);
  }

  if (granularity === "week") {
    const lastDay = addDays(end, -1);
    return `${formatter.format(start)} – ${formatter.format(lastDay)}`;
  }

  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(start);
}

export function dayKeyFromDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayKeyFromIso(iso: string) {
  return dayKeyFromDate(new Date(iso));
}

export function listDayKeysInPeriod(start: Date, end: Date) {
  const keys: string[] = [];
  let cursor = startOfDay(start);
  const limit = startOfDay(end);

  while (cursor < limit) {
    keys.push(dayKeyFromDate(cursor));
    cursor = addDays(cursor, 1);
  }

  return keys;
}

export function formatDayLabel(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function anchorDateKey(anchor: Date) {
  return dayKeyFromDate(normalizeAnchorDate(anchor));
}
