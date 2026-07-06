"use client";

import { Clock } from "lucide-react";
import { useRef, useState } from "react";
import { inputClass } from "@/components/sale/venta-parts";
import { openNativePicker } from "@/lib/native-picker";
import {
  applyScheduleTimePreset,
  formatScheduleTimePart,
  parseScheduleTime,
  scheduleTimePresetMatches,
  type ScheduleTimeKind,
} from "@/components/sale/schedule-time";

const TIME_PRESETS = [
  ["10 AM", "10:00"],
  ["12 PM", "12:00"],
  ["2 PM", "14:00"],
  ["5 PM", "17:00"],
] as const;

function segmentClass(selected: boolean) {
  return selected
    ? "bg-emerald-400 text-slate-950"
    : "text-slate-400 hover:text-slate-200";
}

type ScheduleTimeFieldProps = {
  value: string;
  onChange: (timePart: string) => void;
};

export function ScheduleTimeField({ value, onChange }: ScheduleTimeFieldProps) {
  const parsed = parseScheduleTime(value);
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);
  const [rangeTarget, setRangeTarget] = useState<"start" | "end">("start");

  function update(next: Partial<typeof parsed>) {
    onChange(formatScheduleTimePart({ ...parsed, ...next }));
  }

  function setKind(kind: ScheduleTimeKind) {
    if (kind === parsed.kind) {
      return;
    }

    if (kind === "range") {
      setRangeTarget("start");
      onChange(formatScheduleTimePart({ kind, start: parsed.start, end: parsed.end || "" }));
      return;
    }

    onChange(formatScheduleTimePart({ kind, start: parsed.start }));
  }

  function presetTarget() {
    return parsed.kind === "range" ? rangeTarget : "start";
  }

  function timeInputClass(active: boolean) {
    return `${inputClass} w-full min-w-0 pl-10${active ? " ring-2 ring-emerald-500/70" : ""}`;
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-panel p-1">
        {(
          [
            ["exact", "Puntual"],
            ["range", "Rango"],
            ["from", "Desde"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setKind(kind)}
            className={`h-8 rounded-md text-[11px] font-black transition ${segmentClass(parsed.kind === kind)}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        {parsed.kind === "range" ? (
          <span className="text-[11px] font-black uppercase text-slate-500">
            Atajo para {rangeTarget === "end" ? "Hasta" : "Desde"}
          </span>
        ) : (
          <span className="text-[11px] font-black uppercase text-slate-500">Atajos</span>
        )}
        <div className="flex flex-wrap gap-1.5">
          {TIME_PRESETS.map(([label, time]) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(applyScheduleTimePreset(value, time, presetTarget()))}
              className={`h-8 rounded-md border px-3 text-xs font-black transition ${
                scheduleTimePresetMatches(value, time, presetTarget())
                  ? "border-emerald-600 bg-emerald-400 text-slate-950"
                  : "border-black bg-surface-inset text-slate-300 hover:bg-surface-card-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {parsed.kind === "exact" ? (
        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase text-slate-500">Hora exacta</span>
          <span className="relative block">
            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={startRef}
              className={`${inputClass} w-full pl-10`}
              type="time"
              value={parsed.start}
              onClick={() => openNativePicker(startRef.current)}
              onChange={(event) => update({ start: event.target.value })}
            />
          </span>
        </label>
      ) : null}

      {parsed.kind === "range" ? (
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Desde</span>
            <span className="relative block min-w-0">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={startRef}
                className={timeInputClass(rangeTarget === "start")}
                type="time"
                value={parsed.start}
                onFocus={() => setRangeTarget("start")}
                onClick={() => openNativePicker(startRef.current)}
                onChange={(event) => update({ start: event.target.value })}
              />
            </span>
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Hasta</span>
            <span className="relative block min-w-0">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={endRef}
                className={timeInputClass(rangeTarget === "end")}
                type="time"
                value={parsed.end || ""}
                onFocus={() => setRangeTarget("end")}
                onClick={() => openNativePicker(endRef.current)}
                onChange={(event) => update({ end: event.target.value })}
              />
            </span>
          </label>
        </div>
      ) : null}

      {parsed.kind === "from" ? (
        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase text-slate-500">Desde (en adelante)</span>
          <span className="relative block">
            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={startRef}
              className={`${inputClass} w-full pl-10`}
              type="time"
              value={parsed.start}
              onClick={() => openNativePicker(startRef.current)}
              onChange={(event) => update({ start: event.target.value })}
            />
          </span>
        </label>
      ) : null}
    </div>
  );
}
