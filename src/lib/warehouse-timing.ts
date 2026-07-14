const DATE_TIME_FORMAT = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatWarehouseDateTime(value: string | null | undefined) {
  if (!value) return "Sin registrar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registrar";
  return DATE_TIME_FORMAT.format(date);
}

export function formatWarehouseElapsed(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "Pendiente";
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Sin dato";
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return "Menos de 1 min";
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const remainingMinutes = minutes % 60;
  if (days) return `${days} d ${hours} h`;
  if (hours) return `${hours} h ${remainingMinutes} min`;
  return `${remainingMinutes} min`;
}
