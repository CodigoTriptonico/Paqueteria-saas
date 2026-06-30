import type { OnboardingChecklistItem } from "@/lib/onboarding/micro-steps";

type OnboardingMicroStepChecklistProps = {
  items: OnboardingChecklistItem[];
  compact?: boolean;
};

export function OnboardingMicroStepChecklist({
  items,
  compact = false,
}: OnboardingMicroStepChecklistProps) {
  return (
    <ol className={`grid gap-1 ${compact ? "" : "mt-2"}`}>
      {items.map((item, index) => (
        <li
          key={`${index}-${item.label}`}
          className={`flex items-start gap-2 rounded-md px-1.5 py-1 ${
            item.current ? "bg-emerald-400/10 ring-1 ring-emerald-500/20" : ""
          }`}
        >
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-black ${
              item.done
                ? "border-emerald-600/50 bg-emerald-400/20 text-emerald-200"
                : item.current
                  ? "border-emerald-500 bg-emerald-400 text-slate-950"
                  : "border-black bg-[#1a2320] text-slate-500"
            }`}
            aria-hidden
          >
            {item.done ? "✓" : index + 1}
          </span>
          <span
            className={`text-xs font-bold leading-snug ${
              item.done
                ? "text-slate-500 line-through decoration-slate-600"
                : item.current
                  ? "text-emerald-100"
                  : "text-slate-400"
            }`}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
