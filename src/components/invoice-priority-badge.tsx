import { Star } from "lucide-react";

type InvoicePriorityBadgeProps = {
  className?: string;
  variant?: "inline" | "chip";
  pulsing?: boolean;
};

export function InvoicePriorityBadge({
  className = "",
  variant = "inline",
  pulsing = false,
}: InvoicePriorityBadgeProps) {
  const starClass = pulsing ? "logistics-priority-awaiting-driver" : "";

  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black ${
          pulsing
            ? "border-amber-400/80 bg-amber-400/15 text-amber-100"
            : "border-amber-700/50 bg-amber-950/35 text-amber-200"
        } ${className}`}
      >
        <Star className={`h-3 w-3 shrink-0 fill-amber-300 text-amber-300 ${starClass}`} aria-hidden />
        Prioridad
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-amber-200/90 ${className}`}
      title="Prioridad"
    >
      <Star
        className={`h-3 w-3 shrink-0 fill-amber-300 text-amber-300 ${starClass}`}
        aria-hidden
      />
      Prioridad
    </span>
  );
}
