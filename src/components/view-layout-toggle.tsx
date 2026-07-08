"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import {
  viewLayoutAriaLabel,
  viewLayoutToggleLabel,
  type ViewLayout,
} from "@/lib/view-layout";

type ViewLayoutToggleProps = {
  layout: ViewLayout;
  onToggle: () => void;
  variant?: "default" | "inline";
  className?: string;
};

export function ViewLayoutToggle({
  layout,
  onToggle,
  variant = "default",
  className = "",
}: ViewLayoutToggleProps) {
  const variantClass =
    variant === "inline"
      ? "inline-flex h-10 w-10 shrink-0 items-center justify-center border-l border-black/55 bg-transparent text-slate-400 transition hover:bg-[#243029] hover:text-slate-200"
      : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-400 transition hover:bg-surface-card hover:text-slate-200";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${variantClass}${className ? ` ${className}` : ""}`}
      title={viewLayoutToggleLabel(layout)}
      aria-label={viewLayoutAriaLabel(layout)}
      aria-pressed={layout === "cards"}
    >
      {layout === "rows" ? (
        <LayoutGrid className="h-4 w-4" aria-hidden />
      ) : (
        <Rows3 className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
