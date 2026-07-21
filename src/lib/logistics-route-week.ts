import { formatScheduleDateInput } from "@/lib/schedule-date";


export type LogisticsWeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function getLogisticsWeekdayIndex(date: Date | string): LogisticsWeekdayIndex {
  const parsed =
    typeof date === "string"
      ? new Date(`${date}T12:00:00`)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

  return ((parsed.getDay() + 6) % 7) as LogisticsWeekdayIndex;
}

export function startOfLogisticsWeek(reference = new Date()): Date {
  const anchor = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12);
  anchor.setDate(anchor.getDate() - getLogisticsWeekdayIndex(anchor));
  return anchor;
}


export function resolveRouteDateForWeekday(
  weekdayIndex: LogisticsWeekdayIndex,
  weekStart: Date,
): string {
  const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 12);
  date.setDate(date.getDate() + weekdayIndex);
  return formatScheduleDateInput(date);
}

export function resolveRouteDateForTemplate(taskDate: string, templateWeekday: number) {
  const anchorWeekday = getLogisticsWeekdayIndex(taskDate);
  const date = new Date(`${taskDate}T12:00:00`);
  date.setDate(date.getDate() + (templateWeekday - anchorWeekday));
  return formatScheduleDateInput(date);
}

/** Next calendar date (today or later) that matches a Monday-based logistics weekday. */
export function nextDateForLogisticsWeekday(
  weekdayIndex: LogisticsWeekdayIndex | number,
  from: Date | string = new Date(),
) {
  const base =
    typeof from === "string"
      ? new Date(`${from}T12:00:00`)
      : new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  const current = getLogisticsWeekdayIndex(base);
  let delta = Number(weekdayIndex) - current;
  if (delta < 0) {
    delta += 7;
  }
  base.setDate(base.getDate() + delta);
  return formatScheduleDateInput(base);
}

export function dateMatchesLogisticsWeekday(
  date: string,
  weekdayIndex: LogisticsWeekdayIndex | number,
) {
  return getLogisticsWeekdayIndex(date) === Number(weekdayIndex);
}
