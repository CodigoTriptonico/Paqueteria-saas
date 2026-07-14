import { formatScheduleAtDisplay } from "@/lib/sale/schedule-time";
import { formatScheduleDateInput } from "@/lib/schedule-date";

function scheduleDatePart(scheduleAt: string) {
  return scheduleAt.split("T")[0] || "";
}

export function calendarDaysBetween(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T12:00:00`);
  const to = Date.parse(`${toDate}T12:00:00`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return 0;
  }

  return Math.round((to - from) / 86_400_000);
}

function daysFromToday(scheduleAt: string, reference = new Date()) {
  const today = formatScheduleDateInput(reference);
  return calendarDaysBetween(today, scheduleDatePart(scheduleAt));
}

export function relativeScheduleDayLabel(daysFromTodayValue: number) {
  if (daysFromTodayValue <= 0) {
    return "hoy";
  }

  if (daysFromTodayValue === 1) {
    return "mañana";
  }

  return `dentro de ${daysFromTodayValue} días`;
}

export function markReadyConflictsWithScheduledDate(
  scheduleMode: string,
  scheduleAt: string,
  reference = new Date(),
) {
  if (scheduleMode !== "scheduled" || !scheduleAt) {
    return false;
  }

  return daysFromToday(scheduleAt, reference) > 0;
}

export function applyScheduleChangesCommittedDate(
  existingScheduleAt: string,
  proposedScheduleAt: string,
) {
  if (!existingScheduleAt) {
    return false;
  }

  return scheduleDatePart(existingScheduleAt) !== scheduleDatePart(proposedScheduleAt);
}

export function markReadyScheduleConflictCopy(
  legShort: string,
  scheduleAt: string,
  reference = new Date(),
) {
  const days = daysFromToday(scheduleAt, reference);
  const when = formatScheduleAtDisplay(scheduleAt);
  const relative = relativeScheduleDayLabel(days);

  return {
    title: `¿Marcar como ${legShort.toLowerCase()}?`,
    message: `Esta caja tiene fecha programada para ${when} (${relative}). ¿Seguro que quieres marcarla como ${legShort.toLowerCase()} ahora sin esperar a esa fecha?`,
  };
}

export function applyScheduleDateChangeCopy(
  legShort: string,
  existingScheduleAt: string,
  proposedScheduleAt: string,
  reference = new Date(),
) {
  const days = daysFromToday(existingScheduleAt, reference);
  const relative = relativeScheduleDayLabel(days);

  return {
    title: "¿Cambiar la fecha?",
    message: `Tenía programada para ${formatScheduleAtDisplay(existingScheduleAt)} (${relative}). ¿Aplicar ${formatScheduleAtDisplay(proposedScheduleAt)}?`,
  };
}
