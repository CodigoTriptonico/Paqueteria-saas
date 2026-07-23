import {
  logisticsWeekdayKeys,
  type LogisticsWeekdayKey,
} from "@/lib/logistics-route-catalog";
import { nextDateForLogisticsWeekday } from "@/lib/logistics-route-week";

/** Sentinel used in UI when an enabled day has 0 named templates (the day itself is the route). */
export const DAY_AS_ROUTE_TEMPLATE_ID = "__day_as_route__";

/** Chip labels for Monday→Sunday weekday pickers (same keys as the route catalog). */
export const logisticsWeekdayChipLabels = logisticsWeekdayKeys;

/** Full weekday names for toolbar/select UI (Mon=0…Sun=6). */
export const logisticsWeekdayFullLabels = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/** Options for the logistics day filter: only catalog-enabled weekdays. */
export function logisticsEnabledWeekdayFilterOptions(enabledWeekdays: ReadonlyArray<number>) {
  return enabledWeekdays
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .map((weekday) => ({
      value: weekday,
      label: logisticsWeekdayFullLabels[weekday] || `Día ${weekday}`,
    }));
}

/**
 * Default day for the logistics toolbar filter:
 * today if it is enabled, otherwise the first enabled day, otherwise null.
 */
export function defaultLogisticsWeekdayFilter(
  enabledWeekdays: ReadonlyArray<number>,
  todayWeekday: number,
): number | null {
  const available = enabledWeekdays.filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  if (!available.length) {
    return null;
  }
  if (available.includes(todayWeekday)) {
    return todayWeekday;
  }
  return available[0] ?? null;
}

const logisticsWeekdayFullNames = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const MONTH_SHORT_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/**
 * Resolves a logistics weekday (Mon=0…Sun=6) to the next calendar date on/after `from`.
 * Used when the UI picks a day-of-week instead of a calendar date.
 */
export function selectWeekdayDate(weekday: number, from: Date | string = new Date()) {
  return nextDateForLogisticsWeekday(weekday, from);
}

/** Short operational hint under the weekday picker, e.g. "Próximo: 25 jul 2026". */
export function nextWeekdayScheduleHint(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || "").trim());
  if (!match) {
    return "";
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthLabel = MONTH_SHORT_ES[month - 1];
  if (!monthLabel || !Number.isFinite(day) || !Number.isFinite(year)) {
    return "";
  }
  return `Próximo: ${day} ${monthLabel} ${year}`;
}

export function genericLogisticsRouteName(weekday: number) {
  const name = logisticsWeekdayFullNames[weekday];
  return name ? `Ruta del ${name}` : "";
}

export function isDayAsRouteTemplateId(value: string | null | undefined) {
  return String(value || "").trim() === DAY_AS_ROUTE_TEMPLATE_ID;
}

/** Monday-based indexes (0–6) for catalog-enabled weekdays. */
export function enabledWeekdayIndexes(
  enabledDays: ReadonlyArray<string | LogisticsWeekdayKey>,
): number[] {
  return logisticsWeekdayKeys
    .map((key, index) => (enabledDays.includes(key) ? index : -1))
    .filter((index) => index >= 0);
}

function availableEnabledWeekdayLabels(weekdays: ReadonlyArray<number>) {
  return weekdays
    .map((day) => logisticsWeekdayKeys[day])
    .filter((label): label is LogisticsWeekdayKey => Boolean(label))
    .join(", ");
}

export function availableEnabledDaysHint(weekdays: ReadonlyArray<number>) {
  const labels = availableEnabledWeekdayLabels(weekdays);
  return labels ? `Días disponibles: ${labels}` : "No hay días disponibles en el calendario de rutas.";
}

export function dayAsRouteHint(weekday: number) {
  const label = logisticsWeekdayKeys[weekday] || "Ese día";
  return `${label} es la ruta (sin rutas con nombre).`;
}

/**
 * Picks the template id for a weekday: named templates when present,
 * otherwise the day-as-route sentinel.
 */
export function resolveDayRouteTemplateId(input: {
  weekday: number;
  templates: ReadonlyArray<{ id: string; weekday: number }>;
  currentTemplateId?: string;
  preferNotId?: string;
}): string {
  const dayTemplates = input.templates.filter(
    (template) => Number(template.weekday) === Number(input.weekday),
  );

  if (!dayTemplates.length) {
    return DAY_AS_ROUTE_TEMPLATE_ID;
  }

  const current = String(input.currentTemplateId || "").trim();
  if (current && dayTemplates.some((template) => template.id === current)) {
    return current;
  }

  const preferred =
    dayTemplates.find((template) => template.id !== input.preferNotId) || dayTemplates[0];
  return preferred?.id || DAY_AS_ROUTE_TEMPLATE_ID;
}
