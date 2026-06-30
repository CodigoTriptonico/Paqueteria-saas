"use client";

import { Clock } from "lucide-react";
import { useRef } from "react";
import { inputClass } from "@/components/sale/venta-parts";
import {
  formatScheduleTimePart,
  parseScheduleTime,
  scheduleTimePresetMatches,
  type ScheduleTimeKind,
} from "@/components/sale/schedule-time";

function segmentClass(selected: boolean) {
  return selected
    ? "bg-emerald-400 text-slate-950"
    : "text-slate-400 hover:text-slate-200";
}

function openTimePicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  try {
    input.showPicker?.();
  } catch {
    // Some browsers only allow showPicker directly from a click gesture.
  }
}

type ScheduleTimeFieldProps = {
  value: string;
  onChange: (timePart: string) => void;
};

export function ScheduleTimeField({ value, onChange }: ScheduleTimeFieldProps) {
  const parsed = parseScheduleTime(value);
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);

  function update(next: Partial<typeof parsed>) {
    onChange(formatScheduleTimePart({ ...parsed, ...next }));
  }

  function setKind(kind: ScheduleTimeKind) {
    if (kind === parsed.kind) {
      return;
    }

    if (kind === "range") {
      onChange(formatScheduleTimePart({ kind, start: parsed.start, end: "14:00" }));
      return;
    }

    onChange(formatScheduleTimePart({ kind, start: parsed.start }));
  }

  return (
    <div className="grid gap-2">
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
              onClick={() => openTimePicker(startRef.current)}
              onChange={(event) => update({ start: event.target.value })}
            />
          </span>
        </label>
      ) : null}

      {parsed.kind === "range" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Desde</span>
            <span className="relative block">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={startRef}
                className={`${inputClass} w-full pl-10`}
                type="time"
                value={parsed.start}
                onClick={() => openTimePicker(startRef.current)}
                onChange={(event) => update({ start: event.target.value })}
              />
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500">Hasta</span>
            <span className="relative block">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={endRef}
                className={`${inputClass} w-full pl-10`}
                type="time"
                value={parsed.end || ""}
                onClick={() => openTimePicker(endRef.current)}
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
              onClick={() => openTimePicker(startRef.current)}
              onChange={(event) => update({ start: event.target.value })}
            />
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {[
          ["10 AM", "10:00"],
          ["12 PM", "12:00"],
          ["2 PM", "14:00"],
          ["5 PM", "17:00"],
        ].map(([label, time]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(time)}
            className={`h-8 rounded-md border px-3 text-xs font-black transition ${
              scheduleTimePresetMatches(value, time)
                ? "border-emerald-600 bg-emerald-400 text-slate-950"
                : "border-black bg-surface-inset text-slate-300 hover:bg-surface-card-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
