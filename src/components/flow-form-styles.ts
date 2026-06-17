import { textMutedClass } from "@/components/ui-blocks";

/** Contenedor de página para flujos operativos (venta, wizards). */
export const flowPageShellClass = "mx-auto w-full max-w-lg space-y-5 pb-8";
export const flowPageShellWideClass = "w-full pb-6 sm:pb-8";

/** Marco exterior compartido (barra de pasos, paneles de etapa). */
export const flowStepShellClass =
  "w-full border-y border-black bg-gradient-to-b from-[#1e2a24] to-[#161d19]";

export const flowStepBarShellClass = "w-full border-b border-black bg-[#1c2622]";

export const flowStepShellPaddingClass = "px-2 py-2 sm:px-3 sm:py-2.5";

export const flowStepBarPaddingClass = "px-2 py-1.5 sm:px-3 sm:py-2";

/** Superficie plana para listas de persona (sin caja extra). */
export const flowPersonListShellClass =
  "w-full bg-[#1a221f] px-2 py-2 sm:px-3 sm:py-3";

export const flowPanelFlushClass = "rounded-none border-x-0 shadow-none";

export const flowPanelContentClass = "w-full p-2 sm:p-3";

export const flowStepBodyClass =
  "w-full space-y-3 sm:space-y-4";

/** Panel con borde interior (solo si hace falta separar del shell). */
export const flowStepPanelClass =
  "mx-auto w-full space-y-4 rounded-lg border border-black/70 bg-surface-card/95 p-3 sm:space-y-5 sm:p-5";

/** Columna interior para formularios y listas. */
export const flowStepInnerClass = "w-full space-y-4";

export const flowFormStackClass = "mx-auto flex w-full max-w-md flex-col gap-3";
export const flowWizardStackClass = "mx-auto flex w-full max-w-2xl flex-col gap-4";
export const flowFormStackWideClass = "mx-auto flex w-full max-w-2xl flex-col gap-3";
export const flowFormFieldClass = "w-full";
export const flowFormActionsClass = "flex flex-wrap justify-center gap-2 pt-1";

export const flowLegendClass =
  "flex items-center justify-center gap-2 text-center text-xs font-black uppercase tracking-wide text-emerald-400";

export const flowFieldLabelClass = "text-sm font-black text-slate-300";
export const flowIntroClass = `text-center text-sm ${textMutedClass}`;

export const flowSummaryDlClass = "grid gap-2.5 text-sm sm:grid-cols-2";
export const flowSummaryItemClass =
  "rounded-lg border border-white/10 bg-[#26322e] px-3 py-2.5";

export const flowWizardActionsClass =
  "flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4";

/** Grilla flexible para tarjetas de persona (remitente / destinatario). */
export const flowPersonCardGridClass =
  "grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] items-stretch gap-2 sm:gap-3";

/** Toolbar de listas de persona: buscador + acciones en una fila estable. */
export const flowPersonToolbarClass =
  "grid w-full gap-2 sm:grid-cols-[1fr_auto] sm:items-center";

export const flowToolbarCreateButtonClass =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 text-sm font-black text-slate-300 transition hover:border-emerald-700/40 hover:bg-emerald-400/5 hover:text-emerald-200";

/** Cuerpo de listas de persona — espaciado estable entre toolbar, grilla y paginación. */
export const flowPersonListSectionClass = "w-full space-y-3";

/** Cuerpo de paso con listas de persona — sin altura mínima forzada. */
export const flowPersonStepBodyClass = "w-full space-y-3 sm:space-y-4";

/** Grilla flexible para cajas y tarjetas grandes. */
export const flowCardGridClass =
  "grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]";

export const flowToolbarClass =
  "flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between";

export const flowPagerClass = "flex items-center justify-center gap-2 sm:gap-3";

export const flowPanelTitleClass = "flex w-full justify-center";
