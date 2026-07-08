"use client";

import { ArrowLeft, Bell, CheckCircle2, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OnboardingProgress } from "@/app/actions/onboarding";
import { OnboardingPanel, type OnboardingSummaryFocus } from "@/components/onboarding/onboarding-panel";
import { iconWellEmerald, labelMutedClass } from "@/components/ui-blocks";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { isOnboardingTutorialEnabled } from "@/lib/onboarding/feature";
import { platformAdminNeedsClientContext } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 416;
const PANEL_GAP = 8;

type PanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type NotificationsCenterProps = {
  session: AppSession | null;
  variant?: "bar" | "sidebar" | "brand";
};

type BoxarioBrandHeaderProps = {
  session: AppSession | null;
  compact?: boolean;
  className?: string;
  onBack?: () => void;
  title?: string;
  backTitle?: string;
  railOnly?: boolean;
  sidebarToggle?: {
    collapsed: boolean;
    onToggle: () => void;
  };
};

export function BoxarioBrandHeader({
  session,
  compact = false,
  className = "",
  onBack,
  title = "Boxario",
  backTitle = "Volver",
  railOnly = false,
  sidebarToggle,
}: BoxarioBrandHeaderProps) {
  const shellClass = `flex flex-col rounded-xl border border-black bg-surface-card text-[#f8fafc] shadow-sm ${
    compact ? "h-12 justify-center px-3" : "h-16 justify-center px-4"
  } ${className}`;
  const titleClass = `min-w-0 truncate font-black ${compact ? "text-xl" : "text-2xl"}`;
  const backButtonClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#1a2320] text-emerald-300/90 transition hover:bg-[#243029] hover:text-emerald-200 active:scale-[0.98]";
  const sidebarToggleButtonClass =
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/70 bg-[#1a2320] text-slate-400 transition hover:bg-[#243029] hover:text-slate-200 active:scale-[0.98]";
  const showNotifications = Boolean(session && !platformAdminNeedsClientContext(session));

  const sidebarToggleButton = sidebarToggle ? (
    <button
      type="button"
      onClick={sidebarToggle.onToggle}
      className={sidebarToggleButtonClass}
      aria-label={sidebarToggle.collapsed ? "Expandir menu lateral" : "Colapsar menu lateral"}
      title={sidebarToggle.collapsed ? "Expandir menu" : "Colapsar menu"}
    >
      {sidebarToggle.collapsed ? (
        <PanelLeftOpen className="h-3.5 w-3.5" />
      ) : (
        <PanelLeftClose className="h-3.5 w-3.5" />
      )}
    </button>
  ) : null;

  if (railOnly && sidebarToggleButton) {
    return (
      <div className={`flex justify-center rounded-xl border border-black bg-surface-card p-1.5 ${className}`}>
        {sidebarToggleButton}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        {onBack ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              title={backTitle}
              aria-label={`${backTitle}: ${title}`}
              className={backButtonClass}
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <span className={titleClass}>{title}</span>
          </div>
        ) : (
          <h1 className={titleClass}>Boxario</h1>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {sidebarToggleButton}
          {showNotifications ? <NotificationsCenter session={session} variant="brand" /> : null}
        </div>
      </div>
    </div>
  );
}

function SummaryStatButton({
  label,
  value,
  valueClassName,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  valueClassName: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-2 text-center transition active:scale-[0.98] ${
        active
          ? "border-emerald-600/50 bg-emerald-400/10 ring-1 ring-emerald-500/20"
          : "border-black bg-[#243029] hover:border-emerald-700/30 hover:bg-[#2a332f]"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-black tabular-nums ${valueClassName}`}>{value}</p>
    </button>
  );
}

function NotificationsSummary({
  pendingCount,
  progress,
  activeFocus,
  onAllClick,
  onPendingClick,
  onCompletedClick,
}: {
  pendingCount: number;
  progress: OnboardingProgress | null;
  activeFocus: OnboardingSummaryFocus;
  onAllClick: () => void;
  onPendingClick: () => void;
  onCompletedClick: () => void;
}) {
  const completedCount = progress?.completedCount ?? 0;
  const totalCount = progress?.totalCount ?? 5;

  return (
    <div className="grid grid-cols-3 gap-2 border-b border-black bg-[#1a2320]/80 px-3 py-2.5">
      <SummaryStatButton
        label="Todos"
        value={totalCount}
        valueClassName="text-[#f8fafc]"
        active={activeFocus === "all"}
        onClick={onAllClick}
      />
      <SummaryStatButton
        label="Pendientes"
        value={pendingCount}
        valueClassName="text-emerald-300"
        active={activeFocus === "pending"}
        onClick={onPendingClick}
      />
      <SummaryStatButton
        label="Listos"
        value={completedCount}
        valueClassName="text-[#f8fafc]"
        active={activeFocus === "completed"}
        onClick={onCompletedClick}
      />
    </div>
  );
}

function TutorialPausedState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-black bg-gradient-to-b from-[#243029] to-[#1f2724] px-5 py-8 text-center shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
      <span className={`h-10 w-10 ${iconWellEmerald}`}>
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-3 text-base font-black text-[#f8fafc]">Tutorial en pausa</p>
      <p className="mt-1.5 max-w-[14rem] text-xs font-bold leading-relaxed text-slate-400">
        La guía de configuración inicial está desactivada por ahora. Te avisaremos aquí cuando haya novedades.
      </p>
    </div>
  );
}

function NotificationsEmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-black bg-gradient-to-b from-[#243029] to-[#1f2724] px-5 py-8 text-center shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
      <span className={`h-10 w-10 ${iconWellEmerald}`}>
        <CheckCircle2 className="h-5 w-5" />
      </span>
      <p className="mt-3 text-base font-black text-[#f8fafc]">Todo al día</p>
      <p className="mt-1.5 max-w-[14rem] text-xs font-bold leading-relaxed text-slate-400">
        No hay avisos pendientes. Cuando surjan guías o recordatorios, los verás aquí agrupados.
      </p>
    </div>
  );
}

export function NotificationsCenter({
  session,
  variant = "bar",
}: NotificationsCenterProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [summaryFocus, setSummaryFocus] = useState<OnboardingSummaryFocus>("all");
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { progress, pendingCount, loading } = useOnboardingProgress();
  const hasOnboarding = Boolean(progress?.eligible && !progress?.allComplete);
  const ready = !loading || progress !== null;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const isSidebar = variant === "sidebar";
  const isBrand = variant === "brand";
  const hasPending = pendingCount > 0;

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = isSidebar
      ? Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, rect.width))
      : PANEL_MAX_WIDTH;

    let left = isSidebar ? rect.left : rect.right - width;
    left = Math.max(PANEL_GAP, Math.min(left, window.innerWidth - width - PANEL_GAP));

    const top = rect.bottom + PANEL_GAP;
    const maxHeight = Math.max(240, window.innerHeight - top - PANEL_GAP);

    setPanelPosition({ top, left, width, maxHeight });
  }, [isSidebar]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setSummaryFocus("all");
        setPanelPosition(null);
      });
      return;
    }

    updatePanelPosition();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    function onResize() {
      updatePanelPosition();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [close, open, updatePanelPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      close();
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [close, open]);

  if (!session || platformAdminNeedsClientContext(session)) {
    return null;
  }

  const triggerClass = isBrand
    ? "group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#1a2320] text-slate-400 transition hover:bg-[#243029] hover:text-slate-200"
    : isSidebar
      ? "group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-black bg-surface-card px-3 py-2.5 text-left transition-colors hover:bg-[#2f3834]"
      : "group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-300 transition hover:bg-[#2f3834] hover:text-[#f8fafc]";

  const popover =
    open && panelPosition ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificaciones"
        className="fixed z-[150] flex flex-col overflow-hidden rounded-xl border border-black bg-[#1a221f] shadow-[0_18px_48px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.04]"
        style={{
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelPosition.width,
          maxHeight: panelPosition.maxHeight,
        }}
      >
        <div className="relative shrink-0 overflow-hidden border-b border-black bg-gradient-to-br from-[#243029] via-[#1f2724] to-[#1a221f] px-3.5 pb-3 pt-3">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className={labelMutedClass}>Centro de avisos</p>
                <h2 className="text-base font-black text-[#f8fafc]">Notificaciones</h2>
                <p className="mt-0.5 text-xs font-bold leading-snug text-slate-400">
                  Guías y pendientes para tu operación diaria.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black bg-[#1a2320] text-slate-300 transition hover:bg-surface-card"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {hasOnboarding ? (
            <div className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-200">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
              Configuración inicial en curso
            </div>
          ) : null}
        </div>

        {hasOnboarding ? (
          <NotificationsSummary
            pendingCount={pendingCount}
            progress={progress}
            activeFocus={summaryFocus}
            onAllClick={() => setSummaryFocus("all")}
            onPendingClick={() => setSummaryFocus("pending")}
            onCompletedClick={() => setSummaryFocus("completed")}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <OnboardingPanel
            onNavigate={close}
            summaryFocus={summaryFocus}
          />

          {ready && !hasOnboarding ? (
            isOnboardingTutorialEnabled() ? <NotificationsEmptyState /> : <TutorialPausedState />
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={hasPending ? `Notificaciones, ${pendingCount} pendientes` : "Notificaciones"}
        title={hasPending ? `${pendingCount} notificación${pendingCount === 1 ? "" : "es"} pendiente${pendingCount === 1 ? "" : "s"}` : "Notificaciones"}
      >
        <Bell
          className={`h-4 w-4 shrink-0 transition ${
            hasPending
              ? "text-emerald-300 notification-icon-glow"
              : isSidebar
                ? "text-slate-400 group-hover:text-emerald-300/90"
                : "group-hover:text-emerald-300/90"
          }`}
          aria-hidden
        />
        {isSidebar ? (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-200">
              Notificaciones
            </span>
            {pendingCount > 0 ? (
              <span className="rounded-md border border-emerald-700/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black tabular-nums text-emerald-200">
                {pendingCount}
              </span>
            ) : null}
          </>
        ) : null}
        {(isBrand || !isSidebar) && hasPending ? (
          <span
            className={`absolute flex items-center justify-center rounded-full border border-black bg-emerald-400 font-black text-slate-950 ${
              isBrand
                ? "-right-1 -top-1 h-4 min-w-4 px-1 text-[9px]"
                : "-right-1 -top-1 h-4 min-w-4 px-1 text-[9px] shadow-[0_2px_8px_rgba(52,211,153,0.45)]"
            }`}
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        ) : null}
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}
