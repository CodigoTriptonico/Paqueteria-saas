import type { LogisticsTaskStatus } from "@/app/actions/shipments";

export function isLogisticsFailedTask(task: { status: LogisticsTaskStatus }) {
  return task.status === "cancelled";
}

export function logisticsReprogramStockNotice(task: { stockDeductedAt?: string | null }) {
  if (!task.stockDeductedAt) {
    return null;
  }

  return "La caja ya salió de bodega. No se volverá a descontar stock al cargar.";
}
