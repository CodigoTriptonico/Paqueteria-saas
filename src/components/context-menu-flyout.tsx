"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type ContextMenuFlyoutProps = {
  title: string;
  icon: ReactNode;
  detail?: string;
  active?: boolean;
  scheduleChanged?: boolean;
  panelClassName?: string;
  onMouseEnter?: () => void;
  children: ReactNode;
};

export function ContextMenuFlyout({
  title,
  icon,
  detail,
  active = false,
  scheduleChanged = false,
  panelClassName = "min-w-[16rem]",
  onMouseEnter,
  children,
}: ContextMenuFlyoutProps) {
  return (
    <div className="group relative mt-1">
      <button
        type="button"
        onMouseEnter={onMouseEnter}
        className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-black hover:bg-surface-card ${
          active ? "bg-emerald-950/20" : ""
        }`}
      >
        <span className="text-emerald-300">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[#f8fafc]">{title}</span>
          {detail ? (
            <span className="mt-0.5 block text-[11px] font-bold leading-snug text-slate-500">
              {detail}
            </span>
          ) : null}
          {active ? (
            <span className="mt-1 inline-flex rounded border border-emerald-700/50 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
              Actual
            </span>
          ) : null}
          {scheduleChanged ? (
            <span className="mt-1 inline-flex rounded border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-200">
              Fecha modificada
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      <div
        className={`invisible absolute left-[calc(100%-1px)] top-0 z-50 rounded-xl border border-black bg-surface-panel p-2 opacity-0 shadow-2xl delay-300 duration-150 group-hover:visible group-hover:opacity-100 group-hover:delay-0 ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
