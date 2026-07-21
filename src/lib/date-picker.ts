import { formatScheduleDateInput } from "@/lib/schedule-date";

export type ParsedDateInput = {
  year: number;
  month: number;
  day: number;
};

export type CalendarDayCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

const WEEKDAY_LABELS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

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
] as const;

export function parseDateInput(value: string): ParsedDateInput | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

export function formatDateInputDisplay(value: string) {
  const parsed = parseDateInput(value);

  if (!parsed) {
    return "—";
  }

  const monthName = MONTH_NAMES_ES[parsed.month - 1];

  if (!monthName) {
    const day = String(parsed.day).padStart(2, "0");
    const month = String(parsed.month).padStart(2, "0");
    return `${day}/${month}/${parsed.year}`;
  }

  return `${parsed.day} ${monthName} ${parsed.year}`;
}

export function formatCalendarMonthLabel(year: number, month: number) {
  const monthName = MONTH_NAMES_ES[month - 1];

  if (!monthName) {
    return `${month}/${year}`;
  }

  return `${monthName} ${year}`;
}

export function getWeekdayLabels() {
  return WEEKDAY_LABELS_ES;
}

export function buildCalendarMonth(year: number, month: number): CalendarDayCell[] {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPreviousMonth = new Date(year, month - 1, 0).getDate();
  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - firstWeekday + 1;

    if (dayOffset < 1) {
      const day = daysInPreviousMonth + dayOffset;
      const previousMonth = month === 1 ? 12 : month - 1;
      const previousYear = month === 1 ? year - 1 : year;

      cells.push({
        date: formatScheduleDateInput(new Date(previousYear, previousMonth - 1, day)),
        day,
        inMonth: false,
      });
      continue;
    }

    if (dayOffset > daysInMonth) {
      const day = dayOffset - daysInMonth;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;

      cells.push({
        date: formatScheduleDateInput(new Date(nextYear, nextMonth - 1, day)),
        day,
        inMonth: false,
      });
      continue;
    }

    cells.push({
      date: formatScheduleDateInput(new Date(year, month - 1, dayOffset)),
      day: dayOffset,
      inMonth: true,
    });
  }

  return cells;
}

/** Month grid weeks that contain at least one day of the viewed month (no orphan spill weeks). */
export function buildVisibleCalendarMonth(year: number, month: number): CalendarDayCell[] {
  const cells = buildCalendarMonth(year, month);
  const visible: CalendarDayCell[] = [];

  for (let index = 0; index < cells.length; index += 7) {
    const week = cells.slice(index, index + 7);
    if (week.some((cell) => cell.inMonth)) {
      visible.push(...week);
    }
  }

  return visible;
}

export function shiftCalendarMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month - 1 + delta, 1);

  return {
    year: next.getFullYear(),
    month: next.getMonth() + 1,
  };
}

function isDateBeforeMin(date: string, min?: string) {
  return Boolean(min && date < min);
}

function isDateAfterMax(date: string, max?: string) {
  return Boolean(max && date > max);
}

export function isDateDisabled(
  date: string,
  min?: string,
  max?: string,
  options?: { allowedWeekdays?: number[] },
) {
  if (isDateBeforeMin(date, min) || isDateAfterMax(date, max)) {
    return true;
  }

  const allowed = options?.allowedWeekdays;
  if (!allowed?.length) {
    return false;
  }

  const weekday = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
  return !allowed.includes(weekday);
}

export function resolveCalendarView(value: string, reference = new Date()) {
  const parsed = parseDateInput(value);

  if (parsed) {
    return { year: parsed.year, month: parsed.month };
  }

  return {
    year: reference.getFullYear(),
    month: reference.getMonth() + 1,
  };
}

const DATE_PICKER_PANEL_SELECTOR = "[data-date-picker-panel]";
const TIME_PICKER_PANEL_SELECTOR = "[data-time-picker-panel]";
export const PICKER_PANEL_SELECTOR = `${DATE_PICKER_PANEL_SELECTOR},${TIME_PICKER_PANEL_SELECTOR}`;

export function splitDateTimeInput(value: string) {
  const [date = "", time = ""] = value.split("T");

  return {
    date,
    time: time.slice(0, 5),
  };
}

export function joinDateTimeInput(date: string, time: string) {
  if (!date.trim()) {
    return "";
  }

  const normalizedTime = time.trim() || "09:00";

  return `${date}T${normalizedTime}`;
}

export function formatDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
