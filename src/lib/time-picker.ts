import { formatTime12Hour } from "@/lib/sale/schedule-time";

export type TimePeriod = "AM" | "PM";

export type ParsedTimeInput = {
  hour24: number;
  minute: number;
  hour12: number;
  period: TimePeriod;
};

export const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);

export function parseTimeInput(value: string): ParsedTimeInput | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);

  if (hour24 > 23 || minute > 59) {
    return null;
  }

  const period: TimePeriod = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return { hour24, minute, hour12, period };
}

export function formatTimeInput24(hour24: number, minute: number) {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function from12HourParts(hour12: number, minute: number, period: TimePeriod) {
  let hour24 = hour12 % 12;

  if (period === "PM") {
    hour24 += 12;
  }

  return formatTimeInput24(hour24, minute);
}

export function formatTimeInputDisplay(value: string) {
  if (!value.trim()) {
    return "—";
  }

  const parsed = parseTimeInput(value);

  if (!parsed) {
    return value;
  }

  return formatTime12Hour(value);
}

export function resolveTimePickerView(value: string) {
  const parsed = parseTimeInput(value);

  if (parsed) {
    return parsed;
  }

  return {
    hour24: 10,
    minute: 0,
    hour12: 10,
    period: "AM" as const,
  };
}
