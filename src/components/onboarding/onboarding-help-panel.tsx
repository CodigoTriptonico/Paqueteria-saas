import type { OnboardingHelpBlock } from "@/components/onboarding/onboarding-help";

type OnboardingHelpPanelProps = {
  help: OnboardingHelpBlock;
  className?: string;
};

export function OnboardingHelpPanel({ help, className = "" }: OnboardingHelpPanelProps) {
  return (
    <div
      className={`rounded-lg border border-sky-700/25 bg-sky-950/25 px-3 py-2.5 ${className}`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-sky-300/90">
        ¿Qué es esto?
      </p>
      <p className="mt-1 text-xs font-bold leading-relaxed text-slate-200">{help.what}</p>
      <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-400">
        <span className="text-slate-500">Para qué sirve: </span>
        {help.why}
      </p>
      <p className="mt-2 text-[11px] font-bold leading-relaxed text-emerald-200/90">
        Tip: {help.tip}
      </p>
    </div>
  );
}

type OnboardingInfoButtonProps = {
  active: boolean;
  onClick: () => void;
  label?: string;
  compact?: boolean;
  highlight?: boolean;
};

export function OnboardingInfoButton({
  active,
  onClick,
  label = "Más información",
  compact = false,
  highlight = false,
}: OnboardingInfoButtonProps) {
  const inactiveClass = highlight
    ? "onboarding-help-button-glow border-sky-500/70 bg-sky-400/25 text-sky-100 hover:border-sky-300 hover:bg-sky-400/35 hover:text-white"
    : "border-black bg-[#1a2320] text-slate-400 hover:border-sky-700/35 hover:bg-sky-950/40 hover:text-sky-200";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border font-black transition active:scale-95 ${
        compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"
      } ${
        active
          ? "border-sky-400 bg-sky-400/30 text-sky-50 ring-2 ring-sky-300/50"
          : inactiveClass
      }`}
    >
      !
    </button>
  );
}
