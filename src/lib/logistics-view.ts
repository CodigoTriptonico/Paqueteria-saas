const CLOSED_LOGISTICS_STATUSES = new Set(["completed", "cancelled"]);

export function isClosedLogisticsStatus(status: string) {
  return CLOSED_LOGISTICS_STATUSES.has(status);
}

export function splitLogisticsTasksByOpenState<T extends { status: string }>(tasks: T[]) {
  return {
    open: tasks.filter((task) => !isClosedLogisticsStatus(task.status)),
    closed: tasks.filter((task) => isClosedLogisticsStatus(task.status)),
  };
}
