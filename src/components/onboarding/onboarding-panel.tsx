"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Globe2,
  ListChecks,
  Package,
  Receipt,
  Tags,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type OnboardingProgress,
  type OnboardingStep,
  type OnboardingStepId,
} from "@/app/actions/onboarding";
import { NotificationGroup } from "@/components/notifications/notification-group";
import {
  OnboardingHelpPanel,
  OnboardingInfoButton,
} from "@/components/onboarding/onboarding-help-panel";
import { onboardingGroupHelp, onboardingStepHelp } from "@/components/onboarding/onboarding-help";
import { OnboardingMicroStepChecklist } from "@/components/onboarding/onboarding-micro-step-checklist";
import { useOnboardingHelpSeen } from "@/hooks/use-onboarding-help-seen";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { resolveOnboardingGuideForStep } from "@/lib/onboarding/micro-steps";

const stepIcons: Record<OnboardingStepId, typeof Globe2> = {
  countries: Globe2,
  inventory: Package,
  pricing: Tags,
  stock: Warehouse,
  first_sale: Receipt,
};

function filterStepsByFocus(
  steps: OnboardingStep[],
  summaryFocus: OnboardingSummaryFocus | null,
) {
  if (summaryFocus === "pending") {
    return steps.filter((step) => !step.completed);
  }

  if (summaryFocus === "completed") {
    return steps.filter((step) => step.completed);
  }

  return steps;
}

function OnboardingStepRow({
  step,
  stepNumber,
  isNext,
  isLast,
  progress,
  pathname,
  searchParams,
  onNavigate,
  open,
  onOpenChange,
}: {
  step: OnboardingStep;
  stepNumber: number;
  isNext: boolean;
  isLast: boolean;
  progress: OnboardingProgress;
  pathname: string;
  searchParams: URLSearchParams;
  onNavigate?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { seen: helpSeen, markSeen: markHelpSeen } = useOnboardingHelpSeen(step.id);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const help = onboardingStepHelp[step.id];
  const Icon = stepIcons[step.id];

  const guide = useMemo(() => {
    if (step.completed) {
      return null;
    }

    return resolveOnboardingGuideForStep(step.id, pathname, searchParams, progress);
  }, [pathname, progress, searchParams, step.completed, step.id]);

  function setIsOpen(next: boolean) {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }

  const stepBadgeClass = step.completed
    ? "border-emerald-600/40 bg-emerald-400/15 text-emerald-200"
    : isNext
      ? "border-emerald-500 bg-emerald-400 text-slate-950"
      : "border-black bg-[#1a2320] text-slate-400";

  return (
    <li id={`onboarding-step-${step.id}`} className="relative flex gap-3">
      <div className="flex w-9 shrink-0 flex-col items-center">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black ${stepBadgeClass}`}
          aria-hidden
        >
          {step.completed ? <Check className="h-4 w-4" strokeWidth={2.5} /> : stepNumber}
        </span>
        {!isLast ? <span className="mt-1 w-px flex-1 min-h-3 bg-black/80" aria-hidden /> : null}
      </div>

      <div
        className={`mb-2 min-w-0 flex-1 overflow-hidden rounded-lg border ${
          step.completed
            ? "border-black/70 bg-[#2a332f]/50"
            : isNext
              ? "border-emerald-600/40 bg-[#2f3834] ring-1 ring-emerald-500/15"
              : "border-black bg-[#243029]"
        }`}
      >
        <div className="flex items-start gap-1.5 px-2 py-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 text-left transition-colors hover:opacity-95"
            onClick={() => !step.completed && setIsOpen(!isOpen)}
            aria-expanded={step.completed ? undefined : isOpen}
            disabled={step.completed}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                step.completed
                  ? "border-emerald-700/30 bg-emerald-400/10 text-emerald-300/80"
                  : isNext
                    ? "border-emerald-600/50 bg-emerald-400/15 text-emerald-200"
                    : "border-black bg-[#1a2320] text-slate-500"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Paso {stepNumber}
              </span>
              <span
                className={`mt-0.5 block text-sm font-black leading-snug ${
                  step.completed
                    ? "text-slate-500 line-through decoration-slate-600"
                    : "text-[#f8fafc]"
                }`}
              >
                {step.title}
              </span>
              {!step.completed && isNext ? (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                  <Circle className="h-1.5 w-1.5 fill-current" />
                  Siguiente
                </span>
              ) : null}
            </span>

            {!step.completed ? (
              <ChevronDown
                className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            ) : null}
          </button>

          <OnboardingInfoButton
            compact
            active={showHelp}
            highlight={isNext && !step.completed && !helpSeen}
            onClick={() => {
              if (!helpSeen) {
                markHelpSeen();
              }
              setShowHelp((current) => !current);
            }}
            label={`Qué es el paso ${stepNumber}`}
          />
        </div>

        {showHelp ? <OnboardingHelpPanel help={help} className="mx-2 mb-2" /> : null}

        {!step.completed && isOpen ? (
          <div className="border-t border-black/80 px-3 pb-2.5 pt-2">
            {guide ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {guide.microStepIndex} de {guide.microStepTotal} · {guide.title}
                </p>
                <p className="mt-1 text-xs font-bold leading-relaxed text-slate-300">{guide.body}</p>
                <OnboardingMicroStepChecklist items={guide.checklist} />
              </>
            ) : (
              <p className="text-xs font-bold leading-relaxed text-slate-300">{step.description}</p>
            )}

            {guide?.actionHref && guide.actionLabel ? (
              <Link
                href={guide.actionHref}
                onClick={onNavigate}
                className={`mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition active:scale-[0.99] ${
                  isNext
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border border-black bg-[#1a2320] text-slate-200 hover:bg-[#2a332f]"
                }`}
              >
                {guide.actionLabel}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function OnboardingGroupSkeleton() {
  return (
    <div className="skeleton-card h-[5.5rem] rounded-xl border border-black bg-surface-inset" />
  );
}

export type OnboardingSummaryFocus = "all" | "pending" | "completed";

type OnboardingPanelProps = {
  onNavigate?: () => void;
  onProgressChange?: (progress: OnboardingProgress | null) => void;
  summaryFocus?: OnboardingSummaryFocus | null;
};

export function OnboardingPanel({
  onNavigate,
  onProgressChange,
  summaryFocus = "all",
}: OnboardingPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { progress, loading, error } = useOnboardingProgress();
  const [tasksOpen, setTasksOpen] = useState(true);
  const [openStepId, setOpenStepId] = useState<OnboardingStepId | null>(null);

  useEffect(() => {
    onProgressChange?.(progress);
  }, [onProgressChange, progress]);

  const nextStepId = useMemo(
    () => progress?.steps.find((step) => !step.completed)?.id ?? null,
    [progress],
  );

  useEffect(() => {
    queueMicrotask(() => setOpenStepId(nextStepId));
  }, [summaryFocus, nextStepId]);

  const stepNumberById = useMemo(() => {
    if (!progress) {
      return new Map<OnboardingStepId, number>();
    }

    return new Map(progress.steps.map((step, index) => [step.id, index + 1]));
  }, [progress]);

  if (loading) {
    return <OnboardingGroupSkeleton />;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-rose-700/60 bg-rose-950/35 px-3.5 py-3 text-sm font-bold text-rose-200">
        {error}
      </p>
    );
  }

  if (!progress?.eligible || progress.allComplete) {
    return null;
  }

  const focus = summaryFocus ?? "all";
  const visibleSteps = filterStepsByFocus(progress.steps, focus);

  const parentCompletedCount = focus === "pending" ? 0 : progress.completedCount;
  const parentTotalCount =
    focus === "pending"
      ? progress.pendingCount
      : focus === "completed"
        ? progress.completedCount
        : progress.totalCount;

  return (
    <NotificationGroup
      id="onboarding-initial-tasks"
      title="Tareas iniciales"
      description="Sigue los pasos en orden, del 1 al 5"
      icon={ListChecks}
      completedCount={parentCompletedCount}
      totalCount={Math.max(parentTotalCount, 1)}
      accent="emerald"
      help={onboardingGroupHelp["initial-tasks"]}
      open={tasksOpen}
      onOpenChange={setTasksOpen}
    >
      {visibleSteps.length === 0 ? (
        <p className="rounded-lg border border-black bg-[#243029] px-3 py-2.5 text-center text-xs font-bold text-slate-400">
          {focus === "completed"
            ? "Aún no hay pasos listos."
            : focus === "pending"
              ? "No quedan pasos pendientes."
              : "Sin tareas para mostrar."}
        </p>
      ) : (
        <ol className="grid gap-0 px-1 pb-1">
          {visibleSteps.map((step, index) => (
            <OnboardingStepRow
              key={step.id}
              step={step}
              stepNumber={stepNumberById.get(step.id) ?? index + 1}
              isNext={focus !== "completed" && nextStepId === step.id}
              isLast={index === visibleSteps.length - 1}
              progress={progress}
              pathname={pathname}
              searchParams={searchParams}
              onNavigate={onNavigate}
              open={openStepId === step.id}
              onOpenChange={(next) => setOpenStepId(next ? step.id : null)}
            />
          ))}
        </ol>
      )}
    </NotificationGroup>
  );
}
