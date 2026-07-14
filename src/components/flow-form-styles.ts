import { textMutedClass, cardClass } from "@/components/ui-blocks";

export const flowPageShellWideClass = "flex min-h-0 w-full flex-1 flex-col pb-6 sm:pb-8 lg:overflow-hidden lg:pb-0";

export const flowStepBarShellClass = "w-full border-b border-black bg-[#1c2622]";

export const flowStepBarPaddingClass = "px-2 py-1.5 sm:px-3 sm:py-2";

/** Superficie plana para listas de persona (sin caja extra). */
export const flowPersonListShellClass =
  "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#1a221f] px-2 py-2 sm:px-3 sm:py-3";

export const flowPanelFlushClass = "rounded-none border-x-0 shadow-none";

export const flowPanelContentClass = "w-full p-2 sm:p-3";

export const flowStepBodyClass =
  "w-full space-y-3 sm:space-y-4";

export const flowFormStackClass = "mx-auto flex w-full max-w-md flex-col gap-3";
export const flowWizardStackClass = "mx-auto flex w-full max-w-2xl flex-col gap-4";
export const flowFormFieldClass = "w-full";

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
  "grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-stretch gap-3";

/** Lista de filas de persona — mismo patrón que envíos (caja única + divide-y). */
export const flowPersonRowListFrameClass = `${cardClass} flex flex-col`;
export const flowPersonRowListSlotClass = "flex min-h-0 flex-1 flex-col overflow-y-auto";
export const flowPersonRowListInnerClass = "divide-y divide-black/70";
/** Marco unificado: recientes + buscador + acciones en una sola fila. */
export const flowPersonToolbarShellClass =
  "flex w-full min-w-0 shrink-0 flex-col items-stretch gap-2 overflow-hidden sm:flex-row";

export const flowPersonToolbarRecentsClass =
  "hidden min-w-0 max-w-[15rem] items-center overflow-x-auto rounded-lg border border-black/80 bg-[#18211d] px-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.22)] [scrollbar-width:none] [-ms-overflow-style:none] md:flex [&::-webkit-scrollbar]:hidden";

export const flowPersonToolbarSearchSlotClass =
  `inset-shell flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-black/80 bg-surface-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_20px_rgba(0,0,0,0.2)]`;

export const flowPersonToolbarSearchShellClass =
  "box-border inline-flex h-11 w-full min-w-0 items-center gap-2 rounded-none border-0 bg-transparent px-3 sm:px-3.5";

export const flowPersonToolbarActionsClass =
  "flex shrink-0 items-stretch justify-start gap-2";

export const flowPersonToolbarCountClass =
  "inline-flex h-11 items-center rounded-lg border border-black/80 bg-[#202b26] px-2.5 text-[11px] font-black tabular-nums text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_20px_rgba(0,0,0,0.18)]";

export const flowToolbarCreateButtonClass =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 text-sm font-black text-slate-300 transition hover:border-emerald-700/40 hover:bg-emerald-400/5 hover:text-emerald-200";

export const flowToolbarInlineCreateClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-300/50 bg-emerald-400 bg-gradient-to-b from-emerald-300 to-emerald-500 px-3.5 text-[11px] font-black text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_22px_rgba(16,185,129,0.22)] transition hover:from-emerald-200 hover:to-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 sm:gap-2 sm:px-4 sm:text-xs";

/** Cuerpo compacto para formularios de persona (sin estirar al viewport). */
export const flowPersonFormSectionClass = "flex w-full flex-col";

/** Cuerpo de listas de persona — espaciado estable entre toolbar, grilla y paginación. */
export const flowPersonListSectionClass = "flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden";

/** Grilla flexible para cajas y tarjetas grandes. */
export const flowCardGridClass =
  "grid w-full gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]";
