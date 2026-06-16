"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export type CreateOrgStep = "data" | "done";

export const createOrgSteps: { id: CreateOrgStep; label: string }[] = [
  { id: "data", label: "Datos" },
  { id: "done", label: "Listo" },
];

function stepButtonClass(isActive: boolean, isUnlocked: boolean) {
  if (isActive) {
    return "border-emerald-600 bg-emerald-400 text-slate-950";
  }

  if (isUnlocked) {
    return "border-black bg-surface-card text-slate-300 hover:border-black hover:bg-surface-card-hover";
  }

  return "cursor-not-allowed border-black bg-surface-inset text-slate-500";
}

type PlatformCreateOrgFlowNavProps = {
  activeStep: CreateOrgStep;
  activeStepIndex: number;
  completedStepIndex: number;
  maxUnlockedStepIndex: number;
  canOpenStep: (step: CreateOrgStep) => boolean;
  openStep: (step: CreateOrgStep) => void;
  goStep: (direction: -1 | 1) => void;
};

export function PlatformCreateOrgFlowNav({
  activeStep,
  activeStepIndex,
  completedStepIndex,
  maxUnlockedStepIndex,
  canOpenStep,
  openStep,
  goStep,
}: PlatformCreateOrgFlowNavProps) {
  const currentStep = createOrgSteps[activeStepIndex] ?? createOrgSteps[0];

  return (
    <div className="rounded-xl border border-black bg-surface-panel p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] ring-1 ring-black">
      <div className="mb-3 border-b border-black pb-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Flujo de alta</p>
        <p className="text-[11px] font-black text-slate-500">
          Paso {activeStepIndex + 1} de {createOrgSteps.length}
        </p>
      </div>
      <div className="grid gap-2">
        {createOrgSteps.map((step, index) => {
          const isActive = activeStep === step.id;
          const isUnlocked = canOpenStep(step.id);
          const isDone = index < completedStepIndex;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isUnlocked}
              onClick={() => openStep(step.id)}
              className={`relative flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${stepButtonClass(
                isActive,
                isUnlocked,
              )}`}
              title={step.label}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-black ${
                  isActive
                    ? "bg-slate-950 text-emerald-300"
                    : isDone
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-surface-inset text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{step.label}</span>
                <span
                  className={`block text-[10px] font-black uppercase ${
                    isActive ? "text-slate-800" : "text-slate-500"
                  }`}
                >
                  {isActive ? "Actual" : isDone ? "Listo" : isUnlocked ? "Abierto" : "Bloqueado"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => goStep(-1)}
          disabled={activeStepIndex <= 0}
          className="flex h-10 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
          title="Paso anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => goStep(1)}
          disabled={activeStepIndex >= maxUnlockedStepIndex}
          className="flex h-10 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
          title="Paso siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-black bg-surface-inset px-3 py-2 lg:hidden">
        <p className="text-[10px] font-black uppercase text-slate-500">Paso actual</p>
        <p className="truncate text-sm font-black text-[#f8fafc]">{currentStep.label}</p>
      </div>
    </div>
  );
}
