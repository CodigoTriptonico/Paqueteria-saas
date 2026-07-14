"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { DatePickerCalendar } from "@/components/date-picker-calendar";
import { iconWellEmerald, Panel } from "@/components/ui-blocks";
import { resolveCalendarView } from "@/lib/date-picker";
import { minScheduleDateInput } from "@/lib/schedule-date";

export function DatePickerDemoClient() {
  const [selectedDate, setSelectedDate] = useState("2026-07-10");
  const initialView = resolveCalendarView(selectedDate);
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-black text-[#f8fafc]">Calendario grid</h1>
        <p className="mt-1 text-sm font-bold text-slate-400">
          Mismo lenguaje visual que el selector de tiempo de entrega.
        </p>
      </div>

      <Panel title="Ejemplo integrado">
        <div className="w-fit max-w-full rounded-xl border border-black bg-surface-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-black text-[#f8fafc]">Fecha de ruta</p>
              <p className="text-xs font-bold text-slate-400">
                Elige el día con la misma cuadrícula de números.
              </p>
            </div>
          </div>

          <DateInput
            value={selectedDate}
            min={minScheduleDateInput()}
            ariaLabel="Fecha de ruta de ejemplo"
            onChange={setSelectedDate}
          />
        </div>
      </Panel>

      <Panel title="Calendario suelto">
        <DatePickerCalendar
          value={selectedDate}
          viewYear={viewYear}
          viewMonth={viewMonth}
          min={minScheduleDateInput()}
          onChange={setSelectedDate}
          onViewChange={(year, month) => {
            setViewYear(year);
            setViewMonth(month);
          }}
        />
      </Panel>
    </div>
  );
}
