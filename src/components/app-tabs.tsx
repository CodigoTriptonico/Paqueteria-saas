"use client";

import type { LucideIcon } from "lucide-react";

export type AppTabDefinition<T extends string = string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
};

type AppTabsProps<T extends string> = {
  tabs: AppTabDefinition<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "default" | "compact";
  ariaLabel?: string;
};

function tabButtonClass(active: boolean, compact: boolean) {
  return [
    "inline-flex items-center gap-2.5 rounded-xl border font-black transition",
    compact ? "min-h-10 px-3" : "min-h-12 px-4",
    active
      ? "border-emerald-600 bg-emerald-400/12 text-[#f8fafc] shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]"
      : "border-black bg-surface-card text-slate-400 hover:border-black hover:bg-surface-card-hover hover:text-slate-200",
  ].join(" ");
}

function tabIconWellClass(active: boolean, compact: boolean) {
  return [
    "flex shrink-0 items-center justify-center rounded-lg border",
    compact ? "h-8 w-8" : "h-9 w-9",
    active
      ? "border-emerald-600 bg-emerald-400 text-slate-950"
      : "border-black bg-surface-inset text-slate-400",
  ].join(" ");
}

function hasBadge(badge: string | number | undefined) {
  if (badge == null || badge === "") {
    return false;
  }

  if (typeof badge === "number") {
    return badge > 0;
  }

  return true;
}

export function AppTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
  size = "default",
  ariaLabel,
}: AppTabsProps<T>) {
  const compact = size === "compact";
  const labelClass = compact ? "text-sm" : "text-base";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-2.5 ${className}`.trim()}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={tabButtonClass(active, compact)}
            onClick={() => onChange(tab.id)}
          >
            <span className={tabIconWellClass(active, compact)}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className={`${labelClass} font-black`}>{tab.label}</span>
            {hasBadge(tab.badge) ? (
              <span
                className={`rounded-md border border-black px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                  active ? "bg-emerald-400 text-slate-950" : "bg-surface-inset text-slate-400"
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
