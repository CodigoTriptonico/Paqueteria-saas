export const LOGISTICS_LIVE_REFRESH_MS = 30_000;

export function shouldRunLogisticsLiveRefresh() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}
