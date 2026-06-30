"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  OnboardingHelpPanel,
  OnboardingInfoButton,
} from "@/components/onboarding/onboarding-help-panel";
import type { OnboardingHelpBlock } from "@/components/onboarding/onboarding-help";
import { iconWellEmerald } from "@/components/ui-blocks";

type NotificationGroupProps = {
  id?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  completedCount: number;
  totalCount: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  accent?: "emerald" | "amber" | "sky";
  nested?: boolean;
  help?: OnboardingHelpBlock;
  children: React.ReactNode;
};

const accentStyles = {
  emerald: {
    ring: "ring-emerald-500/15",
    badge: "border-emerald-700/35 bg-emerald-400/10 text-emerald-200",
    bar: "from-emerald-500 to-emerald-300",
    dot: "bg-emerald-400",
  },
  amber: {
    ring: "ring-amber-500/15",
    badge: "border-amber-700/35 bg-amber-400/10 text-amber-200",
    bar: "from-amber-500 to-amber-300",
    dot: "bg-amber-400",
  },
  sky: {
    ring: "ring-sky-500/15",
    badge: "border-sky-700/35 bg-sky-400/10 text-sky-200",
    bar: "from-sky-500 to-sky-300",
    dot: "bg-sky-400",
  },
} as const;

export function NotificationGroup({
  id,
  title,
  description,
  icon: Icon,
  completedCount,
  totalCount,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  accent = "emerald",
  nested = false,
  help,
  children,
}: NotificationGroupProps) {
  const panelId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [showHelp, setShowHelp] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  function setOpen(next: boolean) {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }

  const allComplete = completedCount >= totalCount;
  const pendingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const styles = accentStyles[accent];

  if (nested) {
    return (
      <div id={id} className="border-b border-black/50 last:border-b-0">
        <div
          className={`flex items-center gap-1.5 px-2 py-2.5 ${
            open ? "bg-[#243029]/40" : ""
          }`}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-95"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={panelId}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                allComplete
                  ? "border-emerald-700/30 bg-emerald-400/10 text-emerald-300/90"
                  : "border-black bg-[#1a2320] text-slate-500"
              }`}
            >
              {allComplete ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-xs font-black text-slate-200">{title}</span>
                {!allComplete && pendingCount > 0 ? (
                  <span className="shrink-0 text-[9px] font-black tabular-nums uppercase tracking-wide text-slate-500">
                    {pendingCount} pend.
                  </span>
                ) : null}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-[10px] font-black tabular-nums text-slate-500">
                {completedCount}/{totalCount}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${allComplete ? "bg-emerald-400/80" : styles.dot} opacity-70`}
                aria-hidden
              />
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </span>
          </button>

          {help ? (
            <OnboardingInfoButton
              compact
              active={showHelp}
              onClick={() => setShowHelp((current) => !current)}
              label={`Qué es ${title}`}
            />
          ) : null}
        </div>

        {showHelp && help ? (
          <OnboardingHelpPanel help={help} className="mx-2 mb-2" />
        ) : null}

        {open ? (
          <div id={panelId} className="border-t border-black/40 bg-[#1a2320]/50 px-2 pb-2 pt-1.5">
            <p className="mb-2 px-1 text-[11px] font-bold leading-snug text-slate-500">{description}</p>
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`overflow-hidden rounded-xl border border-black bg-[#1f2724] shadow-[0_8px_24px_rgba(0,0,0,0.2)] ring-1 ring-inset ${styles.ring}`}
    >
      <div className="flex items-start gap-2 px-3.5 py-3.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:opacity-95"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
        >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            allComplete
              ? "border-emerald-600/40 bg-emerald-400/15 text-emerald-200"
              : `${iconWellEmerald} border-emerald-600`
          }`}
        >
          {allComplete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-[#f8fafc]">{title}</span>
            {allComplete ? (
              <span className="rounded-md border border-emerald-700/35 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">
                Completo
              </span>
            ) : pendingCount > 0 ? (
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black tabular-nums uppercase tracking-wide ${styles.badge}`}
              >
                {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs font-bold leading-snug text-slate-400">{description}</span>

          <span className="mt-2.5 flex items-center gap-2">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border border-black bg-[#1a2320]">
              <span
                className={`block h-full rounded-full bg-gradient-to-r ${styles.bar} transition-all duration-500`}
                style={{
                  width: `${Math.max(progressPercent, completedCount > 0 ? 10 : 0)}%`,
                }}
              />
            </span>
            <span className="shrink-0 text-[10px] font-black tabular-nums text-slate-500">
              {completedCount}/{totalCount}
            </span>
          </span>
        </span>

        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
        </button>

        {help ? (
          <OnboardingInfoButton
            active={showHelp}
            onClick={() => setShowHelp((current) => !current)}
            label={`Qué es ${title}`}
          />
        ) : null}
      </div>

      {showHelp && help ? <OnboardingHelpPanel help={help} className="mx-3.5 mb-3" /> : null}

      {open ? (
        <div id={panelId} className="border-t border-black bg-[#1a2320]/60 px-3 pb-3 pt-2">
          <div className="overflow-hidden rounded-lg border border-black/60 bg-[#151d1a]">
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
}
