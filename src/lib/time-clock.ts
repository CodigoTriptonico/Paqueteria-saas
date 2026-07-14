type TimeClockEventType = "clock_in" | "clock_out" | "meal_start" | "meal_end";
export type TimeClockAction = TimeClockEventType;
type TimeClockTimelineState = "off_clock" | "working" | "on_meal";

export type TimeClockEvent = {
  id: string;
  employeeId: string;
  type: TimeClockEventType;
  occurredAt: string;
};

export type TimeClockSettings = {
  timeZone: string;
  weekStartsOn: number;
  dailyOvertimeAfterHours: number;
  weeklyOvertimeAfterHours: number;
  maxDailyHours: number;
  maxWeeklyHours: number;
  overtimeAlertHours: number;
  payPeriodAnchorDate: string;
  payPeriodDays: number;
  missingClockOutAfterHours: number;
  incompleteRecordAfterHours: number;
};

const DEFAULT_TIME_CLOCK_SETTINGS: TimeClockSettings = {
  timeZone: "America/Los_Angeles",
  weekStartsOn: 0,
  dailyOvertimeAfterHours: 8,
  weeklyOvertimeAfterHours: 40,
  maxDailyHours: 12,
  maxWeeklyHours: 48,
  overtimeAlertHours: 12,
  payPeriodAnchorDate: "2026-01-01",
  payPeriodDays: 14,
  missingClockOutAfterHours: 16,
  incompleteRecordAfterHours: 4,
};

export const TIME_CLOCK_ACTION_LABELS: Record<TimeClockAction, string> = {
  clock_in: "Clock In",
  clock_out: "Clock Out",
  meal_start: "Iniciar comida",
  meal_end: "Terminar comida",
};

type TimeClockInterval = {
  start: string;
  end: string;
};

type TimeClockIssue = {
  eventId: string;
  message: string;
};

export type TimeClockTimeline = {
  state: TimeClockTimelineState;
  openSince: string | null;
  intervals: TimeClockInterval[];
  issues: TimeClockIssue[];
};

export type TimeClockDailySummary = {
  date: string;
  weekStart: string;
  paidMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  dailyOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
};

type TimeClockTotals = {
  paidMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
};

export type TimeClockPeriod = {
  start: string;
  end: string;
};

export type TimeClockSummary = {
  timeline: TimeClockTimeline;
  days: TimeClockDailySummary[];
  today: TimeClockTotals;
  week: TimeClockTotals & { start: string; end: string };
  payPeriod: TimeClockTotals & TimeClockPeriod;
};

export type TimeClockAlertCandidate = {
  employeeId: string;
  type:
    | "daily_hours_exceeded"
    | "weekly_hours_exceeded"
    | "overtime_accumulated"
    | "missing_clock_out"
    | "incomplete_record";
  dedupeKey: string;
  title: string;
  description: string;
  facts: Record<string, string | number>;
};

export type TimeClockAlertEmployee = {
  id: string;
  name: string;
  employeeId: string;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function validTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeClockSettings(
  settings?: Partial<TimeClockSettings> | null,
): TimeClockSettings {
  const merged = { ...DEFAULT_TIME_CLOCK_SETTINGS, ...(settings || {}) };

  return {
    ...merged,
    timeZone: validTimeZone(merged.timeZone)
      ? merged.timeZone
      : DEFAULT_TIME_CLOCK_SETTINGS.timeZone,
    weekStartsOn: Math.min(6, Math.max(0, Math.trunc(merged.weekStartsOn))),
    payPeriodDays: [7, 14, 15, 30].includes(Math.trunc(merged.payPeriodDays))
      ? Math.trunc(merged.payPeriodDays)
      : DEFAULT_TIME_CLOCK_SETTINGS.payPeriodDays,
  };
}

export function normalizeEmployeeId(value: string) {
  return value.trim().toLocaleUpperCase("en-US").replace(/\s+/g, "");
}

export function localDateKey(value: string | Date, timeZone: string) {
  const resolvedTimeZone = validTimeZone(timeZone)
    ? timeZone
    : DEFAULT_TIME_CLOCK_SETTINGS.timeZone;
  const formatter =
    dateFormatterCache.get(resolvedTimeZone) ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: resolvedTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  dateFormatterCache.set(resolvedTimeZone, formatter);

  const parts = formatter.formatToParts(new Date(value));
  const entries = new Map(parts.map((part) => [part.type, part.value]));
  return `${entries.get("year")}-${entries.get("month")}-${entries.get("day")}`;
}

function dateFromKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export function addDaysToDateKey(value: string, days: number) {
  const date = dateFromKey(value);
  if (!date) {
    return value;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenDateKeys(start: string, end: string) {
  const startDate = dateFromKey(start);
  const endDate = dateFromKey(end);
  if (!startDate || !endDate) {
    return 0;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function weekStartForDate(value: string, weekStartsOn: number) {
  const date = dateFromKey(value);
  if (!date) {
    return value;
  }
  const offset = (date.getUTCDay() - weekStartsOn + 7) % 7;
  return addDaysToDateKey(value, -offset);
}

export function payPeriodForDate(
  value: string,
  settings?: Partial<TimeClockSettings> | null,
): TimeClockPeriod {
  const resolved = resolveTimeClockSettings(settings);
  const anchor = dateFromKey(resolved.payPeriodAnchorDate)
    ? resolved.payPeriodAnchorDate
    : DEFAULT_TIME_CLOCK_SETTINGS.payPeriodAnchorDate;
  const periodIndex = Math.floor(daysBetweenDateKeys(anchor, value) / resolved.payPeriodDays);
  const start = addDaysToDateKey(anchor, periodIndex * resolved.payPeriodDays);
  return {
    start,
    end: addDaysToDateKey(start, resolved.payPeriodDays - 1),
  };
}

function orderedEvents(events: TimeClockEvent[]) {
  return [...events].sort((left, right) => {
    const timeOrder = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    return timeOrder || left.id.localeCompare(right.id);
  });
}

function buildTimeClockTimeline(events: TimeClockEvent[]): TimeClockTimeline {
  let state: TimeClockTimelineState = "off_clock";
  let workStartedAt: TimeClockEvent | null = null;
  const intervals: TimeClockInterval[] = [];
  const issues: TimeClockIssue[] = [];

  for (const event of orderedEvents(events)) {
    if (Number.isNaN(Date.parse(event.occurredAt))) {
      issues.push({ eventId: event.id, message: "Marca con fecha inválida" });
      continue;
    }

    if (event.type === "clock_in") {
      if (state !== "off_clock") {
        issues.push({ eventId: event.id, message: "Clock In duplicado" });
        continue;
      }
      state = "working";
      workStartedAt = event;
      continue;
    }

    if (event.type === "meal_start") {
      if (state !== "working" || !workStartedAt) {
        issues.push({ eventId: event.id, message: "Comida iniciada fuera de turno" });
        continue;
      }
      intervals.push({ start: workStartedAt.occurredAt, end: event.occurredAt });
      state = "on_meal";
      workStartedAt = event;
      continue;
    }

    if (event.type === "meal_end") {
      if (state !== "on_meal") {
        issues.push({ eventId: event.id, message: "Fin de comida sin inicio" });
        continue;
      }
      state = "working";
      workStartedAt = event;
      continue;
    }

    if (state !== "working" || !workStartedAt) {
      issues.push({ eventId: event.id, message: "Clock Out sin turno activo" });
      continue;
    }

    intervals.push({ start: workStartedAt.occurredAt, end: event.occurredAt });
    state = "off_clock";
    workStartedAt = null;
  }

  return {
    state,
    openSince: workStartedAt?.occurredAt || null,
    intervals: intervals.filter(
      (interval) => Date.parse(interval.end) > Date.parse(interval.start),
    ),
    issues,
  };
}

export function allowedTimeClockActions(events: TimeClockEvent[]) {
  const state = buildTimeClockTimeline(events).state;
  if (state === "working") {
    return ["meal_start", "clock_out"] as TimeClockAction[];
  }
  if (state === "on_meal") {
    return ["meal_end"] as TimeClockAction[];
  }
  return ["clock_in"] as TimeClockAction[];
}

function nextLocalDateChange(cursor: Date, end: Date, timeZone: string) {
  const currentDate = localDateKey(cursor, timeZone);
  let lower = cursor.getTime();
  let upper = Math.min(end.getTime(), lower + 36 * 60 * 60 * 1000);

  while (upper < end.getTime() && localDateKey(new Date(upper), timeZone) === currentDate) {
    upper = Math.min(end.getTime(), upper + 24 * 60 * 60 * 1000);
  }

  if (localDateKey(new Date(upper), timeZone) === currentDate) {
    return end;
  }

  while (upper - lower > 1) {
    const midpoint = Math.floor((lower + upper) / 2);
    if (localDateKey(new Date(midpoint), timeZone) === currentDate) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }

  return new Date(upper);
}

function durationByDate(
  intervals: TimeClockInterval[],
  timeZone: string,
): Map<string, number> {
  const millisecondsByDate = new Map<string, number>();

  for (const interval of intervals) {
    let cursor = new Date(interval.start);
    const end = new Date(interval.end);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor >= end) {
      continue;
    }

    while (cursor < end) {
      const boundary = nextLocalDateChange(cursor, end, timeZone);
      const date = localDateKey(cursor, timeZone);
      millisecondsByDate.set(
        date,
        (millisecondsByDate.get(date) || 0) + boundary.getTime() - cursor.getTime(),
      );
      cursor = boundary;
    }
  }

  return millisecondsByDate;
}

function totalsFromDays(days: TimeClockDailySummary[]): TimeClockTotals {
  return days.reduce(
    (total, day) => ({
      paidMinutes: total.paidMinutes + day.paidMinutes,
      regularMinutes: total.regularMinutes + day.regularMinutes,
      overtimeMinutes: total.overtimeMinutes + day.overtimeMinutes,
    }),
    { paidMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
  );
}

export function buildDailyTimeClockSummaries(
  events: TimeClockEvent[],
  settings?: Partial<TimeClockSettings> | null,
): TimeClockDailySummary[] {
  const resolved = resolveTimeClockSettings(settings);
  const timeline = buildTimeClockTimeline(events);
  const minutesByDate = durationByDate(timeline.intervals, resolved.timeZone);
  const days = [...minutesByDate.entries()]
    .map(([date, milliseconds]) => {
      const paidMinutes = Math.round(milliseconds / 60_000);
      const dailyOvertimeMinutes = Math.max(
        0,
        paidMinutes - Math.round(resolved.dailyOvertimeAfterHours * 60),
      );
      return {
        date,
        weekStart: weekStartForDate(date, resolved.weekStartsOn),
        paidMinutes,
        regularMinutes: paidMinutes - dailyOvertimeMinutes,
        overtimeMinutes: dailyOvertimeMinutes,
        dailyOvertimeMinutes,
        weeklyOvertimeMinutes: 0,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const byWeek = new Map<string, TimeClockDailySummary[]>();
  for (const day of days) {
    const week = byWeek.get(day.weekStart) || [];
    week.push(day);
    byWeek.set(day.weekStart, week);
  }

  for (const weekDays of byWeek.values()) {
    const paidMinutes = weekDays.reduce((total, day) => total + day.paidMinutes, 0);
    const dailyOvertimeMinutes = weekDays.reduce(
      (total, day) => total + day.dailyOvertimeMinutes,
      0,
    );
    let weeklyOvertimeRemaining = Math.max(
      0,
      paidMinutes - Math.round(resolved.weeklyOvertimeAfterHours * 60) - dailyOvertimeMinutes,
    );

    for (const day of [...weekDays].reverse()) {
      if (!weeklyOvertimeRemaining) {
        break;
      }
      const assigned = Math.min(day.regularMinutes, weeklyOvertimeRemaining);
      day.weeklyOvertimeMinutes = assigned;
      day.overtimeMinutes += assigned;
      day.regularMinutes -= assigned;
      weeklyOvertimeRemaining -= assigned;
    }
  }

  return days;
}

export function buildTimeClockSummary(
  events: TimeClockEvent[],
  settings?: Partial<TimeClockSettings> | null,
  now = new Date(),
): TimeClockSummary {
  const resolved = resolveTimeClockSettings(settings);
  const todayKey = localDateKey(now, resolved.timeZone);
  const weekStart = weekStartForDate(todayKey, resolved.weekStartsOn);
  const payPeriod = payPeriodForDate(todayKey, resolved);
  const days = buildDailyTimeClockSummaries(events, resolved);
  const today = totalsFromDays(days.filter((day) => day.date === todayKey));
  const weekDays = days.filter(
    (day) => day.date >= weekStart && day.date <= addDaysToDateKey(weekStart, 6),
  );
  const payPeriodDays = days.filter(
    (day) => day.date >= payPeriod.start && day.date <= payPeriod.end,
  );

  return {
    timeline: buildTimeClockTimeline(events),
    days,
    today,
    week: {
      ...totalsFromDays(weekDays),
      start: weekStart,
      end: addDaysToDateKey(weekStart, 6),
    },
    payPeriod: {
      ...totalsFromDays(payPeriodDays),
      ...payPeriod,
    },
  };
}

export function buildTimeClockAlertCandidates(input: {
  employees: TimeClockAlertEmployee[];
  eventsByEmployee: Map<string, TimeClockEvent[]>;
  settings?: Partial<TimeClockSettings> | null;
  now?: Date;
}): TimeClockAlertCandidate[] {
  const settings = resolveTimeClockSettings(input.settings);
  const now = input.now || new Date();
  const candidates: TimeClockAlertCandidate[] = [];

  for (const employee of input.employees) {
    const events = input.eventsByEmployee.get(employee.id) || [];
    const summary = buildTimeClockSummary(events, settings, now);

    for (const day of summary.days) {
      const hours = day.paidMinutes / 60;
      if (hours > settings.maxDailyHours) {
        candidates.push({
          employeeId: employee.id,
          type: "daily_hours_exceeded",
          dedupeKey: `daily:${employee.id}:${day.date}`,
          title: `${employee.name} excedió horas diarias`,
          description: `${employee.employeeId} registró ${hours.toFixed(2)} h el ${day.date}.`,
          facts: { date: day.date, hours, limit: settings.maxDailyHours },
        });
      }
    }

    const weeks = new Map<string, TimeClockDailySummary[]>();
    for (const day of summary.days) {
      const week = weeks.get(day.weekStart) || [];
      week.push(day);
      weeks.set(day.weekStart, week);
    }
    for (const [weekStart, days] of weeks) {
      const hours = totalsFromDays(days).paidMinutes / 60;
      if (hours > settings.maxWeeklyHours) {
        candidates.push({
          employeeId: employee.id,
          type: "weekly_hours_exceeded",
          dedupeKey: `weekly:${employee.id}:${weekStart}`,
          title: `${employee.name} excedió horas semanales`,
          description: `${employee.employeeId} registró ${hours.toFixed(2)} h desde ${weekStart}.`,
          facts: { weekStart, hours, limit: settings.maxWeeklyHours },
        });
      }
    }

    const overtimeHours = summary.payPeriod.overtimeMinutes / 60;
    if (overtimeHours >= settings.overtimeAlertHours) {
      candidates.push({
        employeeId: employee.id,
        type: "overtime_accumulated",
        dedupeKey: `overtime:${employee.id}:${summary.payPeriod.start}`,
        title: `${employee.name} acumuló horas extra`,
        description: `${employee.employeeId} lleva ${overtimeHours.toFixed(2)} h extra en el período.`,
        facts: {
          periodStart: summary.payPeriod.start,
          periodEnd: summary.payPeriod.end,
          overtimeHours,
          limit: settings.overtimeAlertHours,
        },
      });
    }

    const lastEvent = orderedEvents(events).at(-1);
    if (summary.timeline.state === "off_clock" || !summary.timeline.openSince || !lastEvent) {
      continue;
    }

    const elapsedHours = (now.getTime() - Date.parse(summary.timeline.openSince)) / 3_600_000;
    if (summary.timeline.state === "on_meal") {
      if (elapsedHours >= settings.incompleteRecordAfterHours) {
        candidates.push({
          employeeId: employee.id,
          type: "incomplete_record",
          dedupeKey: `incomplete:${employee.id}:${lastEvent.id}`,
          title: `${employee.name} tiene un registro incompleto`,
          description: `${employee.employeeId} inició comida y no la terminó hace ${elapsedHours.toFixed(1)} h.`,
          facts: { eventId: lastEvent.id, elapsedHours },
        });
      }
      continue;
    }

    if (elapsedHours >= settings.missingClockOutAfterHours) {
      candidates.push({
        employeeId: employee.id,
        type: "missing_clock_out",
        dedupeKey: `missing-clock-out:${employee.id}:${lastEvent.id}`,
        title: `${employee.name} olvidó Clock Out`,
        description: `${employee.employeeId} lleva ${elapsedHours.toFixed(1)} h con turno abierto.`,
        facts: { eventId: lastEvent.id, elapsedHours },
      });
    }
  }

  return candidates;
}

export function hoursFromMinutes(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}
