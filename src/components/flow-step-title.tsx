import { CheckCircle2 } from "lucide-react";

type FlowStepTitleProps = {
  label: React.ReactNode;
  stepNumber?: number;
  done?: boolean;
};

export function FlowStepTitle({ label, stepNumber, done = false }: FlowStepTitleProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
      ) : stepNumber != null ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-sm font-black text-slate-950">
          {stepNumber}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
