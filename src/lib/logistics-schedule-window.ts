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
