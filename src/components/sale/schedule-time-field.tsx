"use client";

import { useState } from "react";
import { TimePickerInput } from "@/components/time-picker-input";
import {
  applyScheduleTimePreset,
  formatScheduleTimePart,
  parseScheduleTime,
  scheduleTimePresetMatches,
  type ScheduleTimeKind,
} from "@/lib/sale/schedule-time";

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
          <TimePickerInput
            value={parsed.start}
            ariaLabel="Hora exacta de entrega"
            onChange={(nextValue) => update({ start: nextValue })}
          />
        </label>
      ) : null}

      {parsed.kind === "range" ? (
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Desde</span>
            <TimePickerInput
              value={parsed.start}
              ariaLabel="Hora desde"
              active={rangeTarget === "start"}
              onFocus={() => setRangeTarget("start")}
              onChange={(nextValue) => update({ start: nextValue })}
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Hasta</span>
            <TimePickerInput
              value={parsed.end || ""}
              ariaLabel="Hora hasta"
              active={rangeTarget === "end"}
              onFocus={() => setRangeTarget("end")}
              onChange={(nextValue) => update({ end: nextValue })}
            />
          </label>
        </div>
      ) : null}

      {parsed.kind === "from" ? (
        <label className="grid gap-1.5">
          <span className="text-[11px] font-black uppercase text-slate-500">Desde (en adelante)</span>
          <TimePickerInput
            value={parsed.start}
            ariaLabel="Hora desde en adelante"
            onChange={(nextValue) => update({ start: nextValue })}
          />
        </label>
      ) : null}
    </div>
  );
}
