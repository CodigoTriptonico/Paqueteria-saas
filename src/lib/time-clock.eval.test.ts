import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/063_time_clock.sql", "utf8");
const actions = readFileSync("src/app/actions/time-clock.ts", "utf8");
const clockScreen = readFileSync("src/components/time-clock/clock-user-client.tsx", "utf8");
const adminScreen = readFileSync("src/components/time-clock/time-clock-admin-client.tsx", "utf8");
const timeClock = readFileSync("src/lib/time-clock.ts", "utf8");
const appFrame = readFileSync("src/components/app-frame.tsx", "utf8");
const shell = readFileSync("src/components/app-shell.tsx", "utf8");
const configClient = readFileSync("src/components/configuracion-client.tsx", "utf8");
const configLabels = readFileSync("src/lib/config-section-labels.ts", "utf8");
const permissions = readFileSync("src/lib/auth/permissions.ts", "utf8");

test("time clock keeps employee punches immutable and scope-limited", () => {
  assert.match(migration, /create table if not exists public\.time_clock_employees/);
  assert.match(migration, /create table if not exists public\.time_clock_events/);
  assert.match(migration, /create table if not exists public\.time_clock_alerts/);
  assert.match(migration, /reject_time_clock_event_mutation/);
  assert.match(migration, /idx_time_clock_employees_global_employee_id/);
  assert.match(migration, /time_clock\.view/);
  assert.match(migration, /time_clock\.manage/);
  assert.match(actions, /readClockSession/);
  assert.match(actions, /allowedTimeClockActions/);
  assert.match(actions, /syncTimeClockAlertsForOrganization/);
});

test("time clock exposes separate employee and administrator surfaces", () => {
  assert.match(clockScreen, /TIME_CLOCK_ACTION_LABELS/);
  assert.match(clockScreen, /clock_in/);
  assert.match(clockScreen, /clock_out/);
  assert.match(clockScreen, /meal_start/);
  assert.match(clockScreen, /meal_end/);
  assert.match(timeClock, /Clock In/);
  assert.match(timeClock, /Clock Out/);
  assert.match(timeClock, /Iniciar comida/);
  assert.match(timeClock, /Terminar comida/);
  assert.match(clockScreen, /Cambiar Employee ID/);
  assert.match(adminScreen, /Historial de marcaciones/);
  assert.match(adminScreen, /Exportar CSV/);
  assert.match(adminScreen, /Reglas y alertas/);
  assert.match(adminScreen, /Abrir pantalla de reloj/);
  assert.doesNotMatch(adminScreen, /Marcaciones, alertas y horas calculadas desde el historial real\./);
  assert.match(appFrame, /pathname\.startsWith\("\/reloj"\)/);
  assert.match(configLabels, /title: "Control de horario"/);
  assert.match(configClient, /CONFIG_SECTION_LABELS\.timeclock/);
  assert.match(configClient, /id: "timeclock"/);
  assert.match(configClient, /TimeClockAdminClient/);
  assert.doesNotMatch(shell, /href: "\/time-clock"/);
  assert.match(permissions, /"\/time-clock"/);
  assert.match(permissions, /time_clock\.view/);
});

test("time clock source remains readable Spanish UTF-8", () => {
  for (const source of [migration, actions, clockScreen, adminScreen]) {
    assert.doesNotMatch(source, /[ÃÂâ]/);
  }
});
