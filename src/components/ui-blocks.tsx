import { LucideIcon } from "lucide-react";
import Link from "next/link";

export const inputClass =
  "h-11 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] outline-none placeholder:font-semibold placeholder:text-slate-500 focus:border-black";

/** Marco para controles con campo transparente dentro (pickers, búsqueda, fecha). */
export const insetShellClass = "inset-shell";

export const pickerShellClass =
  `${insetShellClass} box-border inline-flex h-11 max-w-full items-center gap-2 rounded-lg border border-solid border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc]`;

export const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] hover:border-black hover:bg-surface-card";

const cardHeaderClass =
  "flex items-center gap-3 border-b border-black bg-surface-card-header px-4 py-3";

export const cardClass = "rounded-xl border border-black";

/** Toolbar superior dentro de un Panel, sin caja extra. */
export const panelToolbarClass =
  "relative shrink-0 overflow-visible border-b border-black/70 pb-3";

/** Lista con scroll dentro del panel (sin marco adicional). */
export const panelListScrollClass = "min-h-0 flex-1 overflow-y-auto pr-1";

/** Filas separadas con superficie propia (sin divide-y en caja anidada). */
export const panelListStackClass = "flex flex-col gap-2";

/** Fondo base de cada fila en listados operativos. */
export const listRowBaseClass =
  "rounded-lg border border-black/70 bg-surface-list-row transition-colors";

export const listRowHoverClass = "hover:bg-surface-list-row-hover";

/** Misma superficie de color en tarjetas del listado (modo tarjetas). */
export const listCardShellClass = `${listRowBaseClass} ${listRowHoverClass}`;

export const cardHoverClass =
  "transition-colors hover:border-black hover:bg-surface-card-hover";

/** Selección en tarjetas/listas: borde neutro, estado en el fondo. */
export const unselectedDimClass =
  "opacity-45 saturate-[0.85] transition-opacity hover:opacity-75 hover:saturate-100";

export const selectionShellClass = "border border-black transition-colors";

export const selectionActiveClass = "border-black bg-emerald-400/10 hover:bg-emerald-400/15";

export const accentEmeraldSolid =
  "border border-emerald-600 bg-emerald-400 text-slate-950";

export const iconWellEmerald =
  "flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950";

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
      className={`rounded-xl border border-black bg-surface-shell ${
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
