import type { AppSession } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import {
  addDaysToDateKey,
  buildTimeClockAlertCandidates,
  buildTimeClockSummary,
  localDateKey,
  resolveTimeClockSettings,
  type TimeClockEvent,
  type TimeClockSettings,
  type TimeClockSummary,
} from "@/lib/time-clock";
import type { ClockSessionEmployee } from "@/lib/time-clock-session";

export type TimeClockEmployee = {
  id: string;
  employeeId: string;
  fullName: string;
  employeeType: "clock" | "system";
  profileId: string | null;
  isActive: boolean;
  createdAt: string;
  summary: TimeClockSummary;
};

type TimeClockAlert = {
  id: string;
  employeeId: string;
  type:
    | "daily_hours_exceeded"
    | "weekly_hours_exceeded"
    | "overtime_accumulated"
    | "missing_clock_out"
    | "incomplete_record";
  status: "open" | "acknowledged" | "resolved";
  title: string;
  description: string;
  facts: Record<string, unknown>;
  raisedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};

type TimeClockSystemUser = {
  id: string;
  fullName: string;
  email: string;
};

export type TimeClockDashboardSnapshot = {
  settings: TimeClockSettings;
  employees: TimeClockEmployee[];
  events: TimeClockEvent[];
  alerts: TimeClockAlert[];
  systemUsers: TimeClockSystemUser[];
  generatedAt: string;
  historyStart: string;
};

export type ClockUserSnapshot = {
  employee: {
    id: string;
    employeeId: string;
    fullName: string;
    employeeType: "clock" | "system";
  };
  settings: TimeClockSettings;
  events: TimeClockEvent[];
  summary: TimeClockSummary;
  generatedAt: string;
};

type TimeClockSettingsDbRow = {
  time_zone: string;
  week_starts_on: number;
  daily_overtime_after_hours: number | string;
  weekly_overtime_after_hours: number | string;
  max_daily_hours: number | string;
  max_weekly_hours: number | string;
  overtime_alert_hours: number | string;
  pay_period_anchor_date: string;
  pay_period_days: number;
  missing_clock_out_after_hours: number | string;
  incomplete_record_after_hours: number | string;
};

type TimeClockEmployeeDbRow = {
  id: string;
  employee_id: string;
  full_name: string;
  employee_type: "clock" | "system";
  profile_id: string | null;
  is_active: boolean;
  created_at: string;
};

type TimeClockEventDbRow = {
  id: string;
  employee_id: string;
  event_type: TimeClockEvent["type"];
  occurred_at: string;
};

type TimeClockAlertDbRow = {
  id: string;
  employee_id: string;
  alert_type: TimeClockAlert["type"];
  status: TimeClockAlert["status"];
  title: string;
  description: string;
  facts: Record<string, unknown> | null;
  raised_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

function numberValue(value: number | string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapTimeClockSettings(row?: TimeClockSettingsDbRow | null): TimeClockSettings {
  if (!row) {
    return resolveTimeClockSettings();
  }

  return resolveTimeClockSettings({
    timeZone: row.time_zone,
    weekStartsOn: numberValue(row.week_starts_on, 0),
    dailyOvertimeAfterHours: numberValue(row.daily_overtime_after_hours, 8),
    weeklyOvertimeAfterHours: numberValue(row.weekly_overtime_after_hours, 40),
    maxDailyHours: numberValue(row.max_daily_hours, 12),
    maxWeeklyHours: numberValue(row.max_weekly_hours, 48),
    overtimeAlertHours: numberValue(row.overtime_alert_hours, 12),
    payPeriodAnchorDate: row.pay_period_anchor_date,
    payPeriodDays: numberValue(row.pay_period_days, 14),
    missingClockOutAfterHours: numberValue(row.missing_clock_out_after_hours, 16),
    incompleteRecordAfterHours: numberValue(row.incomplete_record_after_hours, 4),
  });
}

function mapEvent(row: TimeClockEventDbRow): TimeClockEvent {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.event_type,
    occurredAt: row.occurred_at,
  };
}

function canViewTimeClock(session: AppSession) {
  return (
    sessionHasPermission(session, "time_clock.view") ||
    sessionHasPermission(session, "time_clock.manage")
  );
}

function systemUserRows(rows: { id: string; full_name: string | null; email: string }[]) {
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name?.trim() || row.email,
    email: row.email,
  }));
}

export async function loadTimeClockDashboard(
  session: AppSession,
  now = new Date(),
): Promise<TimeClockDashboardSnapshot> {
  if (!canViewTimeClock(session)) {
    throw new Error("FORBIDDEN");
  }

  const supabase = await createScopedSupabase(session);
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }

  const initialSettingsResult = await supabase
    .from("time_clock_settings")
    .select(
      "time_zone, week_starts_on, daily_overtime_after_hours, weekly_overtime_after_hours, max_daily_hours, max_weekly_hours, overtime_alert_hours, pay_period_anchor_date, pay_period_days, missing_clock_out_after_hours, incomplete_record_after_hours",
    )
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (initialSettingsResult.error) {
    throw new Error(initialSettingsResult.error.message);
  }

  const settings = mapTimeClockSettings(
    initialSettingsResult.data as TimeClockSettingsDbRow | null,
  );
  const today = localDateKey(now, settings.timeZone);
  const historyStart = addDaysToDateKey(today, -120);
  const [employeesResult, eventsResult, alertsResult, profilesResult] = await Promise.all([
    supabase
      .from("time_clock_employees")
      .select("id, employee_id, full_name, employee_type, profile_id, is_active, created_at")
      .eq("organization_id", session.organizationId)
      .order("full_name"),
    supabase
      .from("time_clock_events")
      .select("id, employee_id, event_type, occurred_at")
      .eq("organization_id", session.organizationId)
      .gte("occurred_at", `${historyStart}T00:00:00.000Z`)
      .order("occurred_at"),
    supabase
      .from("time_clock_alerts")
      .select("id, employee_id, alert_type, status, title, description, facts, raised_at, acknowledged_at, resolved_at")
      .eq("organization_id", session.organizationId)
      .order("raised_at", { ascending: false })
      .limit(240),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", session.organizationId)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const error =
    employeesResult.error || eventsResult.error || alertsResult.error || profilesResult.error;
  if (error) {
    throw new Error(error.message);
  }

  const events = ((eventsResult.data || []) as TimeClockEventDbRow[]).map(mapEvent);
  const eventsByEmployee = new Map<string, TimeClockEvent[]>();
  for (const event of events) {
    const employeeEvents = eventsByEmployee.get(event.employeeId) || [];
    employeeEvents.push(event);
    eventsByEmployee.set(event.employeeId, employeeEvents);
  }

  const employees = ((employeesResult.data || []) as TimeClockEmployeeDbRow[]).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    employeeType: row.employee_type,
    profileId: row.profile_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    summary: buildTimeClockSummary(eventsByEmployee.get(row.id) || [], settings, now),
  }));

  return {
    settings,
    employees,
    events,
    alerts: ((alertsResult.data || []) as TimeClockAlertDbRow[]).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      type: row.alert_type,
      status: row.status,
      title: row.title,
      description: row.description,
      facts: row.facts || {},
      raisedAt: row.raised_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
    })),
    systemUsers: systemUserRows(
      (profilesResult.data || []) as { id: string; full_name: string | null; email: string }[],
    ),
    generatedAt: now.toISOString(),
    historyStart,
  };
}

export async function loadClockUserSnapshot(
  session: ClockSessionEmployee,
  now = new Date(),
): Promise<ClockUserSnapshot> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase no configurado");
  }

  const [settingsResult, eventsResult] = await Promise.all([
    admin
      .from("time_clock_settings")
      .select(
        "time_zone, week_starts_on, daily_overtime_after_hours, weekly_overtime_after_hours, max_daily_hours, max_weekly_hours, overtime_alert_hours, pay_period_anchor_date, pay_period_days, missing_clock_out_after_hours, incomplete_record_after_hours",
      )
      .eq("organization_id", session.organizationId)
      .maybeSingle(),
    admin
      .from("time_clock_events")
      .select("id, employee_id, event_type, occurred_at")
      .eq("employee_id", session.employeeId)
      .order("occurred_at", { ascending: false })
      .limit(1_000),
  ]);

  if (settingsResult.error || eventsResult.error) {
    throw new Error(settingsResult.error?.message || eventsResult.error?.message || "No se pudo cargar el reloj");
  }

  const settings = mapTimeClockSettings(settingsResult.data as TimeClockSettingsDbRow | null);
  const events = ((eventsResult.data || []) as TimeClockEventDbRow[])
    .map(mapEvent)
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));

  return {
    employee: {
      id: session.employeeId,
      employeeId: session.employeeCode,
      fullName: session.fullName,
      employeeType: session.employeeType,
    },
    settings,
    events,
    summary: buildTimeClockSummary(events, settings, now),
    generatedAt: now.toISOString(),
  };
}

export async function syncTimeClockAlertsForOrganization(
  organizationId: string,
  now = new Date(),
) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase no configurado");
  }

  const [settingsResult, employeesResult, eventsResult, alertsResult] = await Promise.all([
    admin
      .from("time_clock_settings")
      .select(
        "time_zone, week_starts_on, daily_overtime_after_hours, weekly_overtime_after_hours, max_daily_hours, max_weekly_hours, overtime_alert_hours, pay_period_anchor_date, pay_period_days, missing_clock_out_after_hours, incomplete_record_after_hours",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin
      .from("time_clock_employees")
      .select("id, employee_id, full_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    admin
      .from("time_clock_events")
      .select("id, employee_id, event_type, occurred_at")
      .eq("organization_id", organizationId)
      .gte("occurred_at", `${addDaysToDateKey(localDateKey(now, "UTC"), -150)}T00:00:00.000Z`)
      .order("occurred_at"),
    admin
      .from("time_clock_alerts")
      .select("id, dedupe_key, status")
      .eq("organization_id", organizationId)
      .in("status", ["open", "acknowledged", "resolved"]),
  ]);

  const error =
    settingsResult.error || employeesResult.error || eventsResult.error || alertsResult.error;
  if (error) {
    throw new Error(error.message);
  }

  const settings = mapTimeClockSettings(settingsResult.data as TimeClockSettingsDbRow | null);
  const employees = (employeesResult.data || []) as {
    id: string;
    employee_id: string;
    full_name: string;
  }[];
  const eventsByEmployee = new Map<string, TimeClockEvent[]>();
  for (const row of (eventsResult.data || []) as TimeClockEventDbRow[]) {
    const event = mapEvent(row);
    const employeeEvents = eventsByEmployee.get(event.employeeId) || [];
    employeeEvents.push(event);
    eventsByEmployee.set(event.employeeId, employeeEvents);
  }

  const candidates = buildTimeClockAlertCandidates({
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.full_name,
      employeeId: employee.employee_id,
    })),
    eventsByEmployee,
    settings,
    now,
  });
  const existing = new Map(
    ((alertsResult.data || []) as { id: string; dedupe_key: string; status: string }[]).map(
      (alert) => [alert.dedupe_key, alert],
    ),
  );
  const candidateKeys = new Set(candidates.map((candidate) => candidate.dedupeKey));
  const nowIso = now.toISOString();

  for (const candidate of candidates) {
    const current = existing.get(candidate.dedupeKey);
    const payload = {
      employee_id: candidate.employeeId,
      alert_type: candidate.type,
      title: candidate.title,
      description: candidate.description,
      facts: candidate.facts,
      last_seen_at: nowIso,
    };
    const result = current
      ? await admin.from("time_clock_alerts").update(
          current.status === "resolved"
            ? { ...payload, status: "open", raised_at: nowIso, resolved_at: null }
            : payload,
        ).eq("id", current.id)
      : await admin.from("time_clock_alerts").insert({
          organization_id: organizationId,
          dedupe_key: candidate.dedupeKey,
          status: "open",
          raised_at: nowIso,
          ...payload,
        });
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  for (const alert of existing.values()) {
    if (!candidateKeys.has(alert.dedupe_key) && alert.status !== "resolved") {
      const { error: resolveError } = await admin
        .from("time_clock_alerts")
        .update({ status: "resolved", resolved_at: nowIso, last_seen_at: nowIso })
        .eq("id", alert.id);
      if (resolveError) {
        throw new Error(resolveError.message);
      }
    }
  }

  return candidates.length;
}
