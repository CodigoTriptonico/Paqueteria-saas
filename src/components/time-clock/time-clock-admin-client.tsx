"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  acknowledgeTimeClockAlertAction,
  createTimeClockEmployeeAction,
  loadTimeClockDashboardAction,
  updateTimeClockEmployeeAction,
  updateTimeClockSettingsAction,
} from "@/app/actions/time-clock";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import { inputClass, listRowBaseClass, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  hoursFromMinutes,
  type TimeClockSettings,
} from "@/lib/time-clock";
import type {
  TimeClockDashboardSnapshot,
  TimeClockEmployee,
} from "@/lib/time-clock-data";
import { buildTimeClockReportCsv, type TimeClockReportRow } from "@/lib/time-clock-report";

type TimeClockAdminClientProps = {
  initialSnapshot?: TimeClockDashboardSnapshot;
  canManage: boolean;
};

type TimeClockTab = "clock" | "today" | "history" | "reports" | "settings";

type EmployeeDraft = {
  employeeId: string;
  fullName: string;
  employeeType: "clock" | "system";
  profileId: string;
  isActive: boolean;
};

const tabs: AppTabDefinition[] = [
  { id: "clock", label: "Reloj", icon: ExternalLink },
  { id: "today", label: "Hoy", icon: Clock },
  { id: "history", label: "Historial", icon: AlertTriangle },
  { id: "reports", label: "Reportes", icon: Download },
  { id: "settings", label: "Ajustes", icon: Settings2 },
];

const fieldLabelClass = "grid gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500";

function initialEmployeeDraft(): EmployeeDraft {
  return {
    employeeId: "",
    fullName: "",
    employeeType: "clock" as const,
    profileId: "",
    isActive: true,
  };
}

function formatHours(minutes: number) {
  return `${hoursFromMinutes(minutes).toFixed(2)} h`;
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function employeeDraftFromRow(employee: TimeClockEmployee): EmployeeDraft {
  return {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    employeeType: employee.employeeType,
    profileId: employee.profileId || "",
    isActive: employee.isActive,
  };
}

function downloadReport(rows: TimeClockReportRow[]) {
  const blob = new Blob([buildTimeClockReportCsv(rows)], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "time-clock-reporte.csv";
  anchor.click();
  URL.revokeObjectURL(href);
}

export function TimeClockAdminClient({
  initialSnapshot,
  canManage,
}: TimeClockAdminClientProps) {
  const notify = useNotify();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [tab, setTab] = useState<TimeClockTab>("today");
  const [saving, setSaving] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeDraft, setEmployeeDraft] = useState(initialEmployeeDraft);
  const [settingsDraft, setSettingsDraft] = useState<TimeClockSettings | null>(
    initialSnapshot?.settings || null,
  );


  async function reload(showNotice = false) {
    const result = await loadTimeClockDashboardAction();
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setSnapshot(result.data);
    setSettingsDraft(result.data.settings);
    if (showNotice) {
      notify.success("Time Clock actualizado");
    }
  }

  const employeeById = useMemo(
    () => new Map(snapshot?.employees.map((employee) => [employee.id, employee]) || []),
    [snapshot],
  );
  const filteredEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) {
      return snapshot?.employees || [];
    }
    return (snapshot?.employees || []).filter((employee) =>
      [employee.employeeId, employee.fullName, employee.employeeType]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [employeeQuery, snapshot]);
  const todayTotals = useMemo(
    () =>
      (snapshot?.employees || []).reduce(
        (total, employee) => ({
          paidMinutes: total.paidMinutes + employee.summary.today.paidMinutes,
          overtimeMinutes: total.overtimeMinutes + employee.summary.today.overtimeMinutes,
          open: total.open + (employee.summary.timeline.state === "off_clock" ? 0 : 1),
        }),
        { paidMinutes: 0, overtimeMinutes: 0, open: 0 },
      ),
    [snapshot],
  );
  const reportRows = useMemo<TimeClockReportRow[]>(() => {
    return (snapshot?.employees || [])
      .flatMap((employee) =>
        employee.summary.days.map((day) => ({
          employeeId: employee.employeeId,
          employeeName: employee.fullName,
          date: day.date,
          regularHours: hoursFromMinutes(day.regularMinutes),
          overtimeHours: hoursFromMinutes(day.overtimeMinutes),
          totalHours: hoursFromMinutes(day.paidMinutes),
        })),
      )
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [snapshot]);
  const history = useMemo(
    () =>
      [...(snapshot?.events || [])]
        .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
        .map((event) => ({ event, employee: employeeById.get(event.employeeId) }))
        .filter(({ employee }) => !employeeQuery || employee?.fullName.toLowerCase().includes(employeeQuery.toLowerCase()) || employee?.employeeId.toLowerCase().includes(employeeQuery.toLowerCase())),
    [employeeById, employeeQuery, snapshot],
  );

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const input = {
      employeeId: employeeDraft.employeeId,
      fullName: employeeDraft.fullName,
      employeeType: employeeDraft.employeeType,
      profileId: employeeDraft.employeeType === "system" ? employeeDraft.profileId || null : null,
      isActive: employeeDraft.isActive,
    };
    const result = editingEmployeeId
      ? await updateTimeClockEmployeeAction(editingEmployeeId, input)
      : await createTimeClockEmployeeAction(input);
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success(editingEmployeeId ? "Empleado actualizado" : "Empleado creado");
    setEditingEmployeeId(null);
    setEmployeeDraft(initialEmployeeDraft());
    await reload();
  }

  async function toggleEmployee(employee: TimeClockEmployee) {
    setSaving(true);
    const result = await updateTimeClockEmployeeAction(employee.id, {
      ...employeeDraftFromRow(employee),
      isActive: !employee.isActive,
      profileId: employee.profileId,
    });
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success(employee.isActive ? "Empleado desactivado" : "Empleado activado");
    await reload();
  }

  async function acknowledge(alertId: string) {
    const result = await acknowledgeTimeClockAlertAction(alertId);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    await reload();
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsDraft) {
      return;
    }
    setSaving(true);
    const result = await updateTimeClockSettingsAction(settingsDraft);
    setSaving(false);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    notify.success("Reglas de horario guardadas");
    await reload();
  }

  if (!snapshot || !settingsDraft) {
    return (
      <Panel title="Control de horario" className="max-w-xl">
        <p className="text-sm font-bold text-slate-400">No se pudo cargar Time Clock.</p>
        <button type="button" className={`${primaryButtonClass} mt-4`} onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" />
          Cargar módulo
        </button>
      </Panel>
    );
  }

  const visibleTabs = canManage ? tabs : tabs.filter((entry) => entry.id !== "settings");
  const openAlerts = snapshot.alerts.filter((alert) => alert.status !== "resolved");

  return (
    <Panel title="Control de horario" hideHeader className="min-h-0" contentClassName="p-0">
      <div className="space-y-4 p-4 pb-8 sm:p-5 sm:pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AppTabs
            tabs={visibleTabs}
            value={tab}
            onChange={(nextTab) => setTab(nextTab as TimeClockTab)}
            ariaLabel="Secciones de Control de horario"
          />
        </div>

        {tab === "clock" ? (
          <section className="overflow-hidden rounded-xl border border-emerald-700/50 bg-emerald-950/20">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-800/50 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Pantalla de marcación</p>
                <h2 className="mt-1 text-xl font-black text-slate-100">Reloj de empleados</h2>
                <p className="mt-1 max-w-2xl text-sm font-bold text-slate-400">
                  Abre el acceso independiente para probar Clock In, comida, Clock Out y el resumen con un Employee ID.
                </p>
              </div>
              <a href="/reloj" className={primaryButtonClass}>
                <ExternalLink className="h-4 w-4" />
                Abrir pantalla de reloj
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-emerald-100/80 sm:px-5">
              <span>Ruta directa: <code className="rounded bg-black/30 px-1.5 py-0.5 text-emerald-200">/reloj</code></span>
              <span>El empleado entra solamente con su Employee ID.</span>
            </div>
          </section>
        ) : null}

        {tab === "today" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Horas hoy", formatHours(todayTotals.paidMinutes), "text-emerald-300"],
                ["Horas extra", formatHours(todayTotals.overtimeMinutes), "text-amber-300"],
                ["Turnos abiertos", String(todayTotals.open), todayTotals.open ? "text-rose-200" : "text-slate-100"],
              ].map(([label, value, tone]) => (
                <section key={label as string} className="overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
                  <p className="border-b border-black bg-surface-card-header px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                  <p className={`px-3 py-3 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
                </section>
              ))}
            </div>

            {openAlerts.length ? (
              <section className="overflow-hidden rounded-xl border border-amber-800/50 bg-amber-950/20">
                <div className="flex items-center gap-2 border-b border-amber-800/50 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                  <h2 className="font-black text-amber-100">Alertas activas ({openAlerts.length})</h2>
                </div>
                <div className="divide-y divide-amber-900/50">
                  {openAlerts.map((alert) => {
                    const employee = employeeById.get(alert.employeeId);
                    return (
                      <article key={alert.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-100">{alert.title}</p>
                          <p className="mt-1 text-xs font-bold text-amber-100/80">{alert.description}</p>
                          <p className="mt-1 text-[10px] font-black uppercase text-slate-500">{employee?.employeeId || "Empleado"} · {alert.status}</p>
                        </div>
                        {canManage && alert.status === "open" ? (
                          <button type="button" className={`${secondaryButtonClass} h-8 text-xs`} onClick={() => void acknowledge(alert.id)}>
                            <Check className="h-3.5 w-3.5" />
                            Revisar
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-black bg-surface-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black bg-surface-card-header px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-300" />
                  <h2 className="font-black">Empleados</h2>
                </div>
                <input className={`${inputClass} h-9 w-full sm:w-64`} value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Buscar empleado" />
              </div>
              <div className="flex flex-col gap-2 p-2">
                {filteredEmployees.map((employee) => {
                  const state = employee.summary.timeline.state;
                  return (
                    <article key={employee.id} className={`${listRowBaseClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{employee.fullName}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{employee.employeeId} · {employee.employeeType === "clock" ? "Clock User" : "Usuario del sistema"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-black tabular-nums text-emerald-300">{formatHours(employee.summary.today.paidMinutes)}</p>
                          <p className={`text-[10px] font-black uppercase ${state === "off_clock" ? "text-slate-500" : "text-amber-200"}`}>{state === "working" ? "En turno" : state === "on_meal" ? "En comida" : "Fuera"}</p>
                        </div>
                        {canManage ? <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-surface-inset text-slate-300 hover:bg-surface-card-hover" onClick={() => { setEditingEmployeeId(employee.id); setEmployeeDraft(employeeDraftFromRow(employee)); setTab("settings"); }} aria-label={`Editar ${employee.fullName}`}><Pencil className="h-3.5 w-3.5" /></button> : null}
                      </div>
                    </article>
                  );
                })}
                {!filteredEmployees.length ? <p className="px-4 py-8 text-center text-sm font-bold text-slate-500">No hay empleados que mostrar.</p> : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "history" ? (
          <section className="overflow-hidden rounded-xl border border-black bg-surface-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black bg-surface-card-header px-4 py-3">
              <div><h2 className="font-black">Historial de marcaciones</h2><p className="text-xs font-bold text-slate-400">Desde {snapshot.historyStart}</p></div>
              <input className={`${inputClass} h-9 w-full sm:w-64`} value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Filtrar empleado" />
            </div>
            <div className="flex flex-col gap-2 p-2">
              {history.map(({ event, employee }) => (
                <article key={event.id} className={`${listRowBaseClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
                  <div><p className="text-sm font-black">{employee?.fullName || "Empleado eliminado"}</p><p className="mt-1 text-xs font-bold text-slate-400">{employee?.employeeId || "Sin ID"}</p></div>
                  <div className="text-right"><p className="text-sm font-black text-emerald-200">{event.type === "clock_in" ? "Clock In" : event.type === "clock_out" ? "Clock Out" : event.type === "meal_start" ? "Iniciar comida" : "Terminar comida"}</p><p className="mt-1 text-xs font-bold text-slate-400">{formatDateTime(event.occurredAt, snapshot.settings.timeZone)}</p></div>
                </article>
              ))}
              {!history.length ? <p className="px-4 py-8 text-center text-sm font-bold text-slate-500">No hay marcaciones en este rango.</p> : null}
            </div>
          </section>
        ) : null}

        {tab === "reports" ? (
          <div className="space-y-4">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black bg-surface-card p-4">
              <div><h2 className="font-black">Reporte diario</h2><p className="mt-1 text-sm font-bold text-slate-400">Regular y extra calculadas por día desde cada marcación.</p></div>
              <button type="button" className={primaryButtonClass} onClick={() => downloadReport(reportRows)} disabled={!reportRows.length}><Download className="h-4 w-4" />Exportar CSV</button>
            </section>
            <section className="overflow-hidden rounded-xl border border-black bg-surface-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-black bg-surface-card-header px-4 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 sm:grid"><span>Empleado / fecha</span><span>Regular</span><span>Extra</span><span>Total</span></div>
              <div className="flex flex-col gap-2 p-2">
                {reportRows.map((row) => <div key={`${row.employeeId}-${row.date}`} className={`${listRowBaseClass} grid grid-cols-3 gap-x-2 gap-y-1.5 px-3 py-3 text-center text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-3 sm:px-4 sm:py-2.5 sm:text-left`}><div className="col-span-3 min-w-0 text-left"><p className="break-words font-black sm:truncate">{row.employeeName}</p><p className="text-[10px] font-bold text-slate-500">{row.employeeId} · {row.date}</p></div><span className="grid gap-0.5 font-black tabular-nums text-slate-300 sm:block"><small className="text-[9px] font-black uppercase tracking-wide text-slate-500 sm:hidden">Regular</small>{row.regularHours.toFixed(2)}</span><span className="grid gap-0.5 font-black tabular-nums text-amber-300 sm:block"><small className="text-[9px] font-black uppercase tracking-wide text-slate-500 sm:hidden">Extra</small>{row.overtimeHours.toFixed(2)}</span><span className="grid gap-0.5 font-black tabular-nums text-emerald-300 sm:block"><small className="text-[9px] font-black uppercase tracking-wide text-slate-500 sm:hidden">Total</small>{row.totalHours.toFixed(2)}</span></div>)}
                {!reportRows.length ? <p className="px-4 py-8 text-center text-sm font-bold text-slate-500">Aún no hay horas para reportar.</p> : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "settings" && canManage ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <section className="rounded-xl border border-black bg-surface-card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-black">{editingEmployeeId ? "Editar empleado" : "Nuevo empleado"}</h2><p className="mt-1 text-sm font-bold text-slate-400">Clock User entra solo con Employee ID. Usuario del sistema conserva sus permisos normales.</p></div>{editingEmployeeId ? <button type="button" className={`${secondaryButtonClass} h-8 text-xs`} onClick={() => { setEditingEmployeeId(null); setEmployeeDraft(initialEmployeeDraft()); }}>Cancelar</button> : null}</div>
              <form className="mt-4 grid gap-3" onSubmit={saveEmployee}>
                <div className="grid gap-3 sm:grid-cols-2"><label className={fieldLabelClass}>Employee ID<input className={inputClass} value={employeeDraft.employeeId} onChange={(event) => setEmployeeDraft((current) => ({ ...current, employeeId: event.target.value }))} placeholder="EMP-001" required /></label><label className={fieldLabelClass}>Tipo<select className={inputClass} value={employeeDraft.employeeType} onChange={(event) => setEmployeeDraft((current) => ({ ...current, employeeType: event.target.value as "clock" | "system", profileId: "" }))}><option value="clock">Clock User</option><option value="system">Usuario del sistema</option></select></label></div>
                {employeeDraft.employeeType === "system" ? <label className={fieldLabelClass}>Usuario del sistema<select className={inputClass} value={employeeDraft.profileId} onChange={(event) => { const user = snapshot.systemUsers.find((entry) => entry.id === event.target.value); setEmployeeDraft((current) => ({ ...current, profileId: event.target.value, fullName: user?.fullName || current.fullName })); }} required><option value="">Elegir usuario</option>{snapshot.systemUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>)}</select></label> : null}
                <label className={fieldLabelClass}>Nombre<input className={inputClass} value={employeeDraft.fullName} onChange={(event) => setEmployeeDraft((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nombre completo" required /></label>
                <div className="flex flex-wrap gap-2"><button type="submit" className={primaryButtonClass} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{editingEmployeeId ? "Guardar empleado" : "Crear empleado"}</button>{editingEmployeeId ? <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => { const employee = snapshot.employees.find((entry) => entry.id === editingEmployeeId); if (employee) void toggleEmployee(employee); }}>{employeeDraft.isActive ? "Desactivar" : "Activar"}</button> : null}</div>
              </form>
            </section>

            <form className="rounded-xl border border-black bg-surface-card p-4 sm:p-5" onSubmit={saveSettings}>
              <h2 className="font-black">Reglas y alertas</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={fieldLabelClass}>Zona horaria<input className={inputClass} value={settingsDraft.timeZone} onChange={(event) => setSettingsDraft((current) => current ? { ...current, timeZone: event.target.value } : current)} /></label><label className={fieldLabelClass}>Inicio de semana<select className={inputClass} value={settingsDraft.weekStartsOn} onChange={(event) => setSettingsDraft((current) => current ? { ...current, weekStartsOn: Number(event.target.value) } : current)}><option value={0}>Domingo</option><option value={1}>Lunes</option></select></label><label className={fieldLabelClass}>Extra diaria desde<input className={inputClass} type="number" min="0.25" step="0.25" value={settingsDraft.dailyOvertimeAfterHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, dailyOvertimeAfterHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Extra semanal desde<input className={inputClass} type="number" min="0.25" step="0.25" value={settingsDraft.weeklyOvertimeAfterHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, weeklyOvertimeAfterHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Máximo diario<input className={inputClass} type="number" min="0.25" step="0.25" value={settingsDraft.maxDailyHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, maxDailyHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Máximo semanal<input className={inputClass} type="number" min="0.25" step="0.25" value={settingsDraft.maxWeeklyHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, maxWeeklyHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Alerta extra acumulada<input className={inputClass} type="number" min="0" step="0.25" value={settingsDraft.overtimeAlertHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, overtimeAlertHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Olvido Clock Out después de<input className={inputClass} type="number" min="0.25" step="0.25" value={settingsDraft.missingClockOutAfterHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, missingClockOutAfterHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Comida incompleta después de<input className={inputClass} type="number" min="0.25" step="0.25" value={settingsDraft.incompleteRecordAfterHours} onChange={(event) => setSettingsDraft((current) => current ? { ...current, incompleteRecordAfterHours: Number(event.target.value) } : current)} /></label><label className={fieldLabelClass}>Inicio período<input className={inputClass} type="date" value={settingsDraft.payPeriodAnchorDate} onChange={(event) => setSettingsDraft((current) => current ? { ...current, payPeriodAnchorDate: event.target.value } : current)} /></label><label className={fieldLabelClass}>Días por período<select className={inputClass} value={settingsDraft.payPeriodDays} onChange={(event) => setSettingsDraft((current) => current ? { ...current, payPeriodDays: Number(event.target.value) } : current)}><option value={7}>7 días</option><option value={14}>14 días</option><option value={15}>15 días</option><option value={30}>30 días</option></select></label></div>
              <button type="submit" className={`${primaryButtonClass} mt-4 w-full`} disabled={saving}>{saving ? "Guardando..." : "Guardar reglas"}</button>
            </form>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
