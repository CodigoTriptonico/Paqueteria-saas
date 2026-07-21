import { getLogisticsWeekdayIndex, nextDateForLogisticsWeekday } from "@/lib/logistics-route-week";
import { scheduleAtToTimestamp } from "@/lib/sale/schedule-time";
import { scheduledAtToLocalDateInput } from "@/lib/schedule-date";
import { isoToPlanScheduleAt } from "@/lib/shipment-schedule-history";

export function customerRouteReplacementNote(fromRouteName: string, toRouteName: string) {
  return `Ruta del vendedor (${fromRouteName}) reemplazada por ${toRouteName}`;
}

export function draftFromScheduledAt(scheduledAt: string) {
  const plan = isoToPlanScheduleAt(scheduledAt);
  const [date = "", time = "10:00"] = plan.split("T");
  return {
    date,
    time: time.slice(0, 5) || "10:00",
  };
}

export function canSubmitCustomerRouteReplacement(input: {
  routeTemplateId: string;
  date: string;
  time: string;
  driverId: string;
  templateWeekday?: number | null;
}) {
  const routeTemplateId = String(input.routeTemplateId || "").trim();
  const driverId = String(input.driverId || "").trim();
  const scheduledTimestamp = scheduleAtToTimestamp(`${input.date}T${input.time}`);

  if (!routeTemplateId || !driverId || !scheduledTimestamp) {
    return false;
  }

  if (
    input.templateWeekday != null &&
    Number.isInteger(Number(input.templateWeekday)) &&
    getLogisticsWeekdayIndex(input.date) !== Number(input.templateWeekday)
  ) {
    return false;
  }

  return true;
}

export function nextDateForTemplateWeekday(weekday: number, fromScheduledAt: string) {
  const fromDate = scheduledAtToLocalDateInput(fromScheduledAt) || fromScheduledAt.slice(0, 10);
  return nextDateForLogisticsWeekday(weekday, fromDate);
}
