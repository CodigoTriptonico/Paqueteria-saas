import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TIME_CLOCK_SESSION_COOKIE = "boxario_time_clock";

export type ClockSessionEmployee = {
  sessionId: string;
  employeeId: string;
  organizationId: string;
  employeeCode: string;
  fullName: string;
  employeeType: "clock" | "system";
};

export function hashTimeClockToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readClockSession(): Promise<ClockSessionEmployee | null> {
  const token = (await cookies()).get(TIME_CLOCK_SESSION_COOKIE)?.value;
  const admin = createSupabaseAdminClient();
  if (!token || !admin) {
    return null;
  }

  const { data } = await admin
    .from("time_clock_sessions")
    .select(
      "id, employee_id, expires_at, revoked_at, time_clock_employees(id, organization_id, employee_id, full_name, employee_type, is_active)",
    )
    .eq("token_hash", hashTimeClockToken(token))
    .maybeSingle();

  const employeeRelation = data?.time_clock_employees as
    | {
        id: string;
        organization_id: string;
        employee_id: string;
        full_name: string;
        employee_type: "clock" | "system";
        is_active: boolean;
      }
    | {
        id: string;
        organization_id: string;
        employee_id: string;
        full_name: string;
        employee_type: "clock" | "system";
        is_active: boolean;
      }[]
    | null
    | undefined;
  const employee = Array.isArray(employeeRelation) ? employeeRelation[0] : employeeRelation;

  if (
    !data ||
    !employee ||
    data.revoked_at ||
    !employee.is_active ||
    Date.parse(data.expires_at) <= Date.now()
  ) {
    return null;
  }

  void admin
    .from("time_clock_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    sessionId: data.id,
    employeeId: employee.id,
    organizationId: employee.organization_id,
    employeeCode: employee.employee_id,
    fullName: employee.full_name,
    employeeType: employee.employee_type,
  };
}
