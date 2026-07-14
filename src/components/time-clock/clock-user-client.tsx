"use client";

import { Clock, Coffee, LogOut, Play, Square } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  endTimeClockSessionAction,
  recordTimeClockAction,
  startTimeClockSessionAction,
} from "@/app/actions/time-clock";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import {
  allowedTimeClockActions,
  hoursFromMinutes,
  TIME_CLOCK_ACTION_LABELS,
  type TimeClockAction,
} from "@/lib/time-clock";
import type { ClockUserSnapshot } from "@/lib/time-clock-data";

type ClockUserClientProps = {
  initialSnapshot?: ClockUserSnapshot | null;
};

const clockActions: {
  action: TimeClockAction;
  icon: typeof Play;
  tone: string;
}[] = [
  { action: "clock_in", icon: Play, tone: "bg-emerald-400 text-slate-950" },
  { action: "clock_out", icon: Square, tone: "bg-rose-300 text-slate-950" },
  { action: "meal_start", icon: Coffee, tone: "bg-amber-300 text-slate-950" },
  { action: "meal_end", icon: Clock, tone: "bg-sky-300 text-slate-950" },
];

function formatHours(minutes: number) {
  return `${hoursFromMinutes(minutes).toFixed(2)} h`;
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function stateCopy(snapshot: ClockUserSnapshot) {
  if (snapshot.summary.timeline.state === "working") {
    return "Turno activo";
  }
  if (snapshot.summary.timeline.state === "on_meal") {
    return "En comida";
  }
  return "Fuera de turno";
}

export function ClockUserClient({ initialSnapshot = null }: ClockUserClientProps) {
  const [snapshot, setSnapshot] = useState<ClockUserSnapshot | null>(initialSnapshot);
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState<TimeClockAction | "session" | "logout" | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date().toISOString()), 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const allowed = useMemo(
    () => (snapshot ? allowedTimeClockActions(snapshot.events) : []),
    [snapshot],
  );

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving("session");
    const result = await startTimeClockSessionAction(employeeId);
    setSaving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSnapshot(result.data);
    setEmployeeId("");
  }

  async function recordAction(action: TimeClockAction) {
    setError("");
    setSaving(action);
    const result = await recordTimeClockAction(action);
    setSaving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSnapshot(result.data);
  }

  async function changeEmployee() {
    setSaving("logout");
    await endTimeClockSessionAction();
    setSaving(null);
    setSnapshot(null);
    setError("");
  }

  if (!snapshot) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#17201e] p-4 text-[#f8fafc]">
        <form
          onSubmit={startSession}
          className="w-full max-w-sm rounded-xl border border-black bg-surface-panel p-5 shadow-[0_18px_45px_rgba(0,0,0,0.38)] sm:p-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Time Clock</h1>
          <p className="mt-1 text-sm font-bold text-slate-400">
            Escribe tu Employee ID para marcar tu jornada.
          </p>
          <label className="mt-5 grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            Employee ID
            <input
              autoFocus
              className={inputClass}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder="Ej. EMP-001"
              autoComplete="username"
            />
          </label>
          {error ? <p className="mt-3 text-sm font-bold text-rose-200">{error}</p> : null}
          <button
            type="submit"
            className={`${primaryButtonClass} mt-4 h-11 w-full`}
            disabled={saving === "session"}
          >
            {saving === "session" ? "Entrando..." : "Entrar al reloj"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#17201e] p-3 text-[#f8fafc] sm:p-5">
      <section className="mx-auto w-full max-w-xl rounded-xl border border-black bg-surface-panel shadow-[0_18px_45px_rgba(0,0,0,0.34)]">
        <header className="border-b border-black bg-surface-card-header px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-300">Time Clock</p>
              <h1 className="truncate text-2xl font-black">{snapshot.employee.fullName}</h1>
              <p className="mt-1 text-sm font-bold text-slate-400">{snapshot.employee.employeeId}</p>
            </div>
            <span className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
              {stateCopy(snapshot)}
            </span>
          </div>
          <p className="mt-5 text-4xl font-black tabular-nums text-emerald-300">
            {formatTime(now, snapshot.settings.timeZone)}
          </p>
          <p className="mt-1 text-xs font-bold capitalize text-slate-400">
            {formatDate(now, snapshot.settings.timeZone)}
          </p>
        </header>

        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
          {clockActions.map(({ action, icon: Icon, tone }) => {
            const enabled = allowed.includes(action);
            const isSaving = saving === action;
            return (
              <button
                key={action}
                type="button"
                disabled={!enabled || saving !== null}
                onClick={() => void recordAction(action)}
                className={`flex min-h-20 items-center gap-3 rounded-lg border border-black p-3 text-left transition ${
                  enabled
                    ? `${tone} shadow-[0_6px_14px_rgba(0,0,0,0.18)] active:scale-[0.99]`
                    : "bg-surface-inset text-slate-600 opacity-55"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-black/20 bg-black/10">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-black">
                  {isSaving ? "Guardando..." : TIME_CLOCK_ACTION_LABELS[action]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-px border-y border-black bg-black sm:grid-cols-3">
          {[
            ["Hoy", snapshot.summary.today.paidMinutes, snapshot.summary.today.overtimeMinutes],
            ["Semana", snapshot.summary.week.paidMinutes, snapshot.summary.week.overtimeMinutes],
            ["Período", snapshot.summary.payPeriod.paidMinutes, snapshot.summary.payPeriod.overtimeMinutes],
          ].map(([label, minutes, overtime]) => (
            <div key={label as string} className="bg-surface-card px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-black tabular-nums text-slate-100">
                {formatHours(minutes as number)}
              </p>
              <p className="mt-1 text-xs font-bold text-amber-200">
                Extra: {formatHours(overtime as number)}
              </p>
            </div>
          ))}
        </div>

        {error ? <p className="px-4 pt-4 text-sm font-bold text-rose-200">{error}</p> : null}
        <div className="p-4 sm:p-5">
          <button
            type="button"
            className={`${secondaryButtonClass} h-10 w-full text-sm`}
            onClick={() => void changeEmployee()}
            disabled={saving === "logout"}
          >
            <LogOut className="h-4 w-4" />
            {saving === "logout" ? "Saliendo..." : "Cambiar Employee ID"}
          </button>
        </div>
      </section>
    </main>
  );
}
