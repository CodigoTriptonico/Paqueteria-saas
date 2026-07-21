export function logisticsScheduleWindowPatch(scheduledAt: string | null | undefined) {
  const schedule = scheduledAt?.trim() || null;

  if (!schedule) {
    return {
      scheduled_at: null,
      requested_schedule_at: null,
      schedule_confirmation_status: "confirmed" as const,
      schedule_kind: null,
      window_start_at: null,
      window_end_at: null,
    };
  }

  return {
    scheduled_at: schedule,
    requested_schedule_at: schedule,
    schedule_confirmation_status: "pending" as const,
    schedule_kind: "exact" as const,
    window_start_at: schedule,
    window_end_at: null,
  };
}

/**
 * Records a requested route day without inventing an appointment time.
 * Noon local avoids a UTC date rollover while the task remains unconfirmed.
 */
export function logisticsRequestedRouteDayPatch(routeDate: string | null | undefined) {
  const date = routeDate?.trim() || "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return logisticsScheduleWindowPatch(null);
  }

  const requestedAt = new Date(`${date}T12:00:00`);

  if (Number.isNaN(requestedAt.getTime())) {
    return logisticsScheduleWindowPatch(null);
  }

  return {
    scheduled_at: null,
    requested_schedule_at: requestedAt.toISOString(),
    schedule_confirmation_status: "pending" as const,
    schedule_kind: null,
    window_start_at: null,
    window_end_at: null,
  };
}
