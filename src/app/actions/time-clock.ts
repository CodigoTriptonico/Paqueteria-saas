"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import {
  loadClockUserSnapshot,
  loadTimeClockDashboard,
  syncTimeClockAlertsForOrganization,
  type ClockUserSnapshot,
  type TimeClockDashboardSnapshot,
} from "@/lib/time-clock-data";
import {
  allowedTimeClockActions,
  normalizeEmployeeId,
  resolveTimeClockSettings,
  type TimeClockAction,
} from "@/lib/time-clock";
import {
  hashTimeClockToken,
  readClockSession,
  TIME_CLOCK_SESSION_COOKIE,
} from "@/lib/time-clock-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createScopedSupabase } from "@/lib/supabase/scoped";

type TimeClockEmployeeInput = {
  employeeId: string;
  fullName: string;
  employeeType: "clock" | "system";
  profileId?: string | null;
  isActive?: boolean;
};

type TimeClockSettingsInput = {
  timeZone: string;
  weekStartsOn: number;
  dailyOvertimeAfterHours: number;
  weeklyOvertimeAfterHours: number;
  maxDailyHours: number;
  maxWeeklyHours: number;
  overtimeAlertHours: number;
  payPeriodAnchorDate: string;
  payPeriodDays: number;
  missingClockOutAfterHours: number;
  incompleteRecordAfterHours: number;
};

function canViewTimeClock(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return (
    sessionHasPermission(session, "time_clock.view") ||
    sessionHasPermission(session, "time_clock.manage")
  );
}

function canManageTimeClock(session: Awaited<ReturnType<typeof requireAppSession>>) {
  return sessionHasPermission(session, "time_clock.manage");
}

function validateEmployeeInput(input: TimeClockEmployeeInput) {
  const employeeId = input.employeeId.trim();
  const employeeIdKey = normalizeEmployeeId(employeeId);
  const fullName = input.fullName.trim();
  if (!employeeId || !employeeIdKey || employeeIdKey.length > 80) {
    throw new Error("Employee ID requerido");
  }
  if (!fullName || fullName.length > 160) {
    throw new Error("Nombre del empleado requerido");
  }
  if (input.employeeType !== "clock" && input.employeeType !== "system") {
    throw new Error("Tipo de empleado inválido");
  }
  if (input.employeeType === "system" && !input.profileId) {
    throw new Error("Selecciona el usuario del sistema");
  }
  return { employeeId, employeeIdKey, fullName };
}

async function assertSystemProfile(
  profileId: string | null | undefined,
  organizationId: string,
) {
  if (!profileId) {
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase no configurado");
  }
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) {
    throw new Error("Usuario del sistema no encontrado");
  }
}

function validateSettingsInput(input: TimeClockSettingsInput) {
  const settings = resolveTimeClockSettings(input);
  const numericFields = [
    input.dailyOvertimeAfterHours,
    input.weeklyOvertimeAfterHours,
    input.maxDailyHours,
    input.maxWeeklyHours,
    input.overtimeAlertHours,
    input.missingClockOutAfterHours,
    input.incompleteRecordAfterHours,
  ];
  if (numericFields.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Las horas configuradas deben ser números válidos");
  }
  if (
    input.dailyOvertimeAfterHours <= 0 ||
    input.weeklyOvertimeAfterHours <= 0 ||
    input.maxDailyHours <= 0 ||
    input.maxWeeklyHours <= 0 ||
    input.missingClockOutAfterHours <= 0 ||
    input.incompleteRecordAfterHours <= 0
  ) {
    throw new Error("Los límites de horas deben ser mayores que cero");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payPeriodAnchorDate)) {
    throw new Error("Fecha de inicio de período inválida");
  }
  if (settings.timeZone !== input.timeZone) {
    throw new Error("Zona horaria inválida");
  }
  return settings;
}

export async function loadTimeClockDashboardAction(): Promise<
  ActionResult<TimeClockDashboardSnapshot>
> {
  try {
    const session = await requireAppSession();
    if (!canViewTimeClock(session)) {
      throw new Error("FORBIDDEN");
    }
    if (canManageTimeClock(session)) {
      await syncTimeClockAlertsForOrganization(session.organizationId);
    }
    return ok(await loadTimeClockDashboard(session));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function createTimeClockEmployeeAction(
  input: TimeClockEmployeeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAppSession();
    if (!canManageTimeClock(session)) {
      throw new Error("FORBIDDEN");
    }
    const values = validateEmployeeInput(input);
    await assertSystemProfile(input.employeeType === "system" ? input.profileId : null, session.organizationId);
    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }
    const { data, error } = await supabase
      .from("time_clock_employees")
      .insert({
        organization_id: session.organizationId,
        employee_id: values.employeeId,
        employee_id_key: values.employeeIdKey,
        full_name: values.fullName,
        employee_type: input.employeeType,
        profile_id: input.employeeType === "system" ? input.profileId || null : null,
        is_active: input.isActive ?? true,
        created_by: session.userId,
        updated_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !data) {
      return fail(error?.code === "23505" ? "Employee ID o usuario ya existe" : error?.message || "No se pudo crear el empleado");
    }
    revalidatePath("/time-clock");
    revalidatePath("/configuracion");
    return ok({ id: data.id });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateTimeClockEmployeeAction(
  employeeId: string,
  input: TimeClockEmployeeInput,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!canManageTimeClock(session)) {
      throw new Error("FORBIDDEN");
    }
    const values = validateEmployeeInput(input);
    await assertSystemProfile(input.employeeType === "system" ? input.profileId : null, session.organizationId);
    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }
    const { error } = await supabase
      .from("time_clock_employees")
      .update({
        employee_id: values.employeeId,
        employee_id_key: values.employeeIdKey,
        full_name: values.fullName,
        employee_type: input.employeeType,
        profile_id: input.employeeType === "system" ? input.profileId || null : null,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      })
      .eq("id", employeeId)
      .eq("organization_id", session.organizationId);
    if (error) {
      return fail(error.code === "23505" ? "Employee ID o usuario ya existe" : error.message);
    }
    revalidatePath("/time-clock");
    revalidatePath("/configuracion");
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function updateTimeClockSettingsAction(
  input: TimeClockSettingsInput,
): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!canManageTimeClock(session)) {
      throw new Error("FORBIDDEN");
    }
    const settings = validateSettingsInput(input);
    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }
    const { error } = await supabase.from("time_clock_settings").upsert({
      organization_id: session.organizationId,
      time_zone: settings.timeZone,
      week_starts_on: settings.weekStartsOn,
      daily_overtime_after_hours: settings.dailyOvertimeAfterHours,
      weekly_overtime_after_hours: settings.weeklyOvertimeAfterHours,
      max_daily_hours: settings.maxDailyHours,
      max_weekly_hours: settings.maxWeeklyHours,
      overtime_alert_hours: settings.overtimeAlertHours,
      pay_period_anchor_date: settings.payPeriodAnchorDate,
      pay_period_days: settings.payPeriodDays,
      missing_clock_out_after_hours: settings.missingClockOutAfterHours,
      incomplete_record_after_hours: settings.incompleteRecordAfterHours,
      updated_at: new Date().toISOString(),
      updated_by: session.userId,
    });
    if (error) {
      return fail(error.message);
    }
    await syncTimeClockAlertsForOrganization(session.organizationId);
    revalidatePath("/time-clock");
    revalidatePath("/configuracion");
    revalidatePath("/reloj");
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function acknowledgeTimeClockAlertAction(alertId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireAppSession();
    if (!canManageTimeClock(session)) {
      throw new Error("FORBIDDEN");
    }
    const supabase = await createScopedSupabase(session);
    if (!supabase) {
      return fail("Supabase no configurado");
    }
    const { error } = await supabase
      .from("time_clock_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: session.userId,
      })
      .eq("id", alertId)
      .eq("organization_id", session.organizationId)
      .eq("status", "open");
    if (error) {
      return fail(error.message);
    }
    revalidatePath("/time-clock");
    revalidatePath("/configuracion");
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function startTimeClockSessionAction(
  employeeId: string,
): Promise<ActionResult<ClockUserSnapshot>> {
  try {
    const employeeIdKey = normalizeEmployeeId(employeeId);
    if (!employeeIdKey) {
      return fail("Escribe tu Employee ID");
    }
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }
    const { data: employee } = await admin
      .from("time_clock_employees")
      .select("id, organization_id, employee_id, full_name, employee_type, is_active")
      .eq("employee_id_key", employeeIdKey)
      .eq("is_active", true)
      .maybeSingle();
    if (!employee) {
      return fail("Employee ID no disponible");
    }
    const now = new Date();
    const token = randomBytes(32).toString("hex");
    await admin
      .from("time_clock_sessions")
      .update({ revoked_at: now.toISOString() })
      .eq("employee_id", employee.id)
      .is("revoked_at", null);
    const { error } = await admin.from("time_clock_sessions").insert({
      employee_id: employee.id,
      token_hash: hashTimeClockToken(token),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) {
      return fail(error.message);
    }
    (await cookies()).set(TIME_CLOCK_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return ok(
      await loadClockUserSnapshot({
        sessionId: "",
        employeeId: employee.id,
        organizationId: employee.organization_id,
        employeeCode: employee.employee_id,
        fullName: employee.full_name,
        employeeType: employee.employee_type as "clock" | "system",
      }),
    );
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function recordTimeClockAction(
  action: TimeClockAction,
): Promise<ActionResult<ClockUserSnapshot>> {
  try {
    const clockSession = await readClockSession();
    if (!clockSession) {
      return fail("Sesion de reloj requerida");
    }
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return fail("Supabase no configurado");
    }
    const { data: lastEvents, error: eventsError } = await admin
      .from("time_clock_events")
      .select("id, employee_id, event_type, occurred_at")
      .eq("employee_id", clockSession.employeeId)
      .order("occurred_at", { ascending: false })
      .limit(64);
    if (eventsError) {
      return fail(eventsError.message);
    }
    const eventHistory = (lastEvents || [])
      .map((event) => ({
        id: event.id as string,
        employeeId: event.employee_id as string,
        type: event.event_type as TimeClockAction,
        occurredAt: event.occurred_at as string,
      }))
      .reverse();
    if (!allowedTimeClockActions(eventHistory).includes(action)) {
      return fail("Esta acción no corresponde al estado actual del reloj");
    }
    const { error } = await admin.from("time_clock_events").insert({
      organization_id: clockSession.organizationId,
      employee_id: clockSession.employeeId,
      event_type: action,
      occurred_at: new Date().toISOString(),
      source: "clock_user",
    });
    if (error) {
      return fail(error.message);
    }
    await syncTimeClockAlertsForOrganization(clockSession.organizationId);
    revalidatePath("/reloj");
    return ok(await loadClockUserSnapshot(clockSession));
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}

export async function endTimeClockSessionAction(): Promise<ActionResult<null>> {
  try {
    const token = (await cookies()).get(TIME_CLOCK_SESSION_COOKIE)?.value;
    const admin = createSupabaseAdminClient();
    if (token && admin) {
      await admin
        .from("time_clock_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", hashTimeClockToken(token));
    }
    (await cookies()).set(TIME_CLOCK_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    revalidatePath("/reloj");
    return ok(null);
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
