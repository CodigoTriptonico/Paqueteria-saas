export function estimateRouteStopEtaMinutes(stopOrder: number, minutesPerStop = 25) {
  if (!Number.isFinite(stopOrder) || stopOrder < 1) {
    return null;
  }

  return stopOrder * minutesPerStop;
}

export function formatEtaMinutes(totalMinutes: number | null) {
  if (totalMinutes === null || !Number.isFinite(totalMinutes)) {
    return null;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes} min`;
}
