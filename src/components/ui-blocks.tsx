import { LucideIcon } from "lucide-react";
import Link from "next/link";

export const inputClass =
  "h-11 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] outline-none placeholder:font-semibold placeholder:text-slate-500 focus:border-black";

export const pickerShellClass =
  "box-border inline-flex h-11 max-w-full items-center gap-2 rounded-lg border border-solid border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc]";

export const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] hover:border-black hover:bg-surface-card";

export const cardHeaderClass =
  "flex items-center gap-3 border-b border-black bg-surface-card-header px-4 py-3";

/** Header band for split cards (inventario categorías, items, etc.) */
export const cardBodyHeaderClass = "border-b border-black bg-surface-card-header";

export const cardClass =
  "rounded-xl border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)]";

export const cardHoverClass =
  "transition-colors hover:border-black hover:bg-surface-card-hover";

/** Selección en tarjetas/listas: borde neutro, estado en el fondo. */
export const unselectedDimClass =
  "opacity-45 saturate-[0.85] transition-opacity hover:opacity-75 hover:saturate-100";

export const selectionShellClass =
  "border border-black shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors";

export const selectionActiveClass = "border-black bg-emerald-400/10 hover:bg-emerald-400/15";

export const selectionIdleClass =
  "border-black bg-surface-card hover:bg-surface-card-hover";

export function selectionSurfaceClass(selected: boolean, dimmed = false) {
  if (selected) {
    return `${selectionShellClass} ${selectionActiveClass}`;
  }

  return `${selectionShellClass} ${selectionIdleClass}${dimmed ? ` ${unselectedDimClass}` : ""}`;
}

export const accentEmeraldSolid =
  "border border-emerald-600 bg-emerald-400 text-slate-950";

export const accentAmberSolid = "border border-amber-600 bg-amber-400 text-slate-950";

export const accentSkySolid = "border border-sky-600 bg-sky-400 text-slate-950";

export const accentRoseSolid = "border border-rose-600 bg-rose-400 text-slate-950";

export const accentMutedSolid = "border border-black bg-surface-inset text-slate-300";

export const iconWellEmerald =
  "flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950";

export const iconWellMuted =
  "flex items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300";

export const alertAmberSolid =
  "rounded-lg border border-amber-600 bg-amber-400 font-black text-slate-950";

export const badgeEmeraldSolid =
  "inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-400 font-black text-slate-950";

export const labelMutedClass = "text-xs font-black uppercase text-slate-500";

export const textMutedClass = "text-sm font-bold text-slate-300";

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
      <p className="border-b border-black bg-surface-card-header px-3 py-2 text-xs font-black uppercase text-slate-400">
        {label}
      </p>
      <p className={`px-3 py-3 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export function BigAction({
  title,
  text,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  text: string;
  icon: LucideIcon;
  color: string;
  href?: string;
}) {
  const className = `${cardClass} ${cardHoverClass} block p-4 text-left`;
  const content = (
    <>
      <span
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-black text-slate-950 ${color}`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="block text-xl font-black text-[#f8fafc]">{title}</span>
      <span className={`mt-1 block ${textMutedClass}`}>{text}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <button className={className}>{content}</button>;
}

export function Panel({
  title,
  action,
  hideHeader = false,
  children,
  className,
  contentClassName,
  clipContent = true,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  hideHeader?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** false permite menús desplegables (p. ej. selector de país) sin recortar */
  clipContent?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-black bg-surface-panel shadow-md ${
        clipContent ? "overflow-hidden" : "overflow-visible"
      } ${className ?? ""}`}
    >
      {hideHeader ? null : (
        <div className={`flex flex-wrap items-center gap-3 sm:px-5 ${cardHeaderClass}`}>
          {action}
          <h3 className="min-w-0 text-xl font-black tracking-tight text-[#f8fafc] sm:text-2xl">{title}</h3>
        </div>
      )}
      <div className={contentClassName ?? "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}
