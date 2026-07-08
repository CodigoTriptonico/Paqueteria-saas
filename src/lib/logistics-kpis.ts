import type { LogisticsRouteRow } from "@/lib/logistics-routing";
import type { LogisticsTaskStatus } from "@/app/actions/shipments";

export type LogisticsKpiInput = {
  routes: ReadonlyArray<Pick<LogisticsRouteRow, "status" | "stops">>;
  tasks: ReadonlyArray<{ status: LogisticsTaskStatus }>;
};

export function computeLogisticsKpis(input: LogisticsKpiInput) {
  const completedRoutes = input.routes.filter((route) => route.status === "completed").length;
  const plannedRoutes = input.routes.filter((route) => route.status === "planned").length;
  const failedTasks = input.tasks.filter((task) => task.status === "cancelled").length;
  const completedTasks = input.tasks.filter((task) => task.status === "completed").length;
  const openTasks = input.tasks.filter(
    (task) => task.status !== "completed" && task.status !== "cancelled",
  ).length;

  return {
    completedRoutes,
    plannedRoutes,
    failedTasks,
    completedTasks,
    openTasks,
    failureRate:
      completedTasks + failedTasks > 0
        ? failedTasks / (completedTasks + failedTasks)
        : 0,
  };
}
