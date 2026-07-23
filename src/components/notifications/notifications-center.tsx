"use client";

import Link from "next/link";
import { ArrowLeft, Bell, CheckCircle2, ChevronsDownUp, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OnboardingProgress } from "@/app/actions/onboarding";
import { OnboardingPanel } from "@/components/onboarding/onboarding-panel";
import { OnboardingStartPanel } from "@/components/onboarding/onboarding-start-panel";
import { iconWellEmerald, labelMutedClass, textTruncateSafeClass } from "@/components/ui-blocks";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { useHydrated } from "@/hooks/use-hydrated";
import { isPlatformOnlySession } from "@/lib/auth/permissions";
import { setOnboardingNotificationsPanelOpen } from "@/lib/onboarding/notifications-panel";
import {
  resolveOrganizationBrandingFromSession,
} from "@/lib/organizations/branding";
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

type OnboardingCompletionNotice = {
  completedTitle: string;
  nextTitle: string;
};

const ONBOARDING_COMPLETION_NOTICE_MS = 1_200;

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
  backTarget?: string;
  keepBrand?: boolean;
  reserveBackSlot?: boolean;
  sidebarGroupsToggle?: {
    allExpanded: boolean;
    onToggle: () => void;
  };
};

const backButtonClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-700/40 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/15 hover:text-emerald-200 active:scale-[0.98]";
const homeButtonClass =
  "inline-flex h-8 min-w-0 items-center rounded-lg px-1.5 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70";

type SidebarCollapseButtonProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarCollapseButton({
  collapsed,
  onToggle,
}: SidebarCollapseButtonProps) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const title = collapsed ? "Mostrar menú lateral" : "Ocultar menú lateral";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-label={title}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-400 transition hover:bg-[#2f3834] hover:text-slate-200 active:scale-[0.98]"
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

export function BoxarioBrandHeader({
  session,
  compact = false,
  className = "",
  onBack,
  title,
  backTitle = "Volver",
  backTarget,
  keepBrand = false,
  reserveBackSlot = false,
  sidebarGroupsToggle,
}: BoxarioBrandHeaderProps) {
  const isHydrated = useHydrated();
  const branding = resolveOrganizationBrandingFromSession({
    organizationName: session?.organizationName ?? "",
    organizationShortName: session?.organizationShortName,
    organizationLogoUrl: session?.organizationLogoUrl,
  });
  const brandTitle = branding.brandTitle;
  const resolvedTitle = title ?? brandTitle;
  const shellClass = `relative flex h-12 items-center overflow-visible rounded-xl border border-black bg-surface-card-header px-2 py-1.5 text-[#f8fafc] shadow-[0_6px_18px_rgba(0,0,0,0.2)] ${
    compact ? "" : "px-2.5"
  } ${className}`;
  const titleClass = `font-black tracking-tight ${
    compact ? "text-base" : "text-lg"
  } ${textTruncateSafeClass}`;
  const showNotifications = Boolean(session && !isPlatformOnlySession(session));
  const expandAllGroupsLabel = sidebarGroupsToggle?.allExpanded
    ? "Contraer todos los grupos del menú"
    : "Expandir todos los grupos del menú";
  const showContextualTitle =
    isHydrated && onBack && !keepBrand && resolvedTitle !== brandTitle;
  const showContextBack = Boolean(onBack);
  const showReservedBack = !showContextBack && reserveBackSlot && !keepBrand;

  return (
    <div className={shellClass}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {isHydrated && showContextBack ? (
          <button
            type="button"
            onClick={onBack}
            title={backTitle}
            aria-label={`${backTitle}: ${title}`}
            data-onboarding-target={backTarget}
            className={backButtonClass}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>
        ) : showReservedBack ? (
          <span className={backButtonClass} aria-hidden>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          </span>
        ) : null}
        {onBack && !keepBrand && showContextualTitle ? (
          <span className={`min-w-0 flex-1 ${titleClass}`}>{resolvedTitle}</span>
        ) : (
          <Link
            href="/"
            prefetch
            aria-label="Ir al inicio"
            title="Ir al inicio"
            className={`${homeButtonClass} min-w-0 flex-1`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md border border-black/40 object-cover"
                />
              ) : null}
              <h1 className={`min-w-0 flex-1 ${titleClass}`}>{brandTitle}</h1>
            </span>
          </Link>
        )}
      </div>
      <div className="ml-1 flex h-8 shrink-0 items-center gap-1">
        {sidebarGroupsToggle ? (
          <button
            type="button"
            onClick={sidebarGroupsToggle.onToggle}
            title={expandAllGroupsLabel}
            aria-label={expandAllGroupsLabel}
            aria-expanded={sidebarGroupsToggle.allExpanded}
            className={backButtonClass}
          >
            <ChevronsDownUp
              className={`h-4 w-4 transition-transform duration-200 ${
                sidebarGroupsToggle.allExpanded ? "rotate-180" : ""
              }`}
              strokeWidth={2.5}
              aria-hidden
            />
          </button>
        ) : null}
        {showNotifications ? <NotificationsCenter session={session} variant="brand" /> : null}
      </div>
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
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [completionNotice, setCompletionNotice] = useState<OnboardingCompletionNotice | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousProgressRef = useRef<OnboardingProgress | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { progress, pendingCount, loading, error } = useOnboardingProgress(session?.organizationId);
  const hasOnboarding = Boolean(progress?.eligible && !progress?.allComplete);
  const tutorialStarted = Boolean(progress?.started);
  const hasActiveTutorial = hasOnboarding && tutorialStarted;
  const hasPausedTutorial = hasOnboarding && !tutorialStarted;
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
    const previous = previousProgressRef.current;
    previousProgressRef.current = progress;

    if (
      !previous ||
      !progress?.started ||
      !previous.started ||
      progress.completedCount <= previous.completedCount
    ) {
      return;
    }

    const completedStep = progress.steps.find(
      (step) => step.completed && !previous.steps.find((previousStep) => previousStep.id === step.id)?.completed,
    );
    const nextStep = progress.steps.find((step) => !step.completed);

    if (!completedStep || !nextStep) {
      return;
    }

    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }

    setCompletionNotice({
      completedTitle: completedStep.title,
      nextTitle: nextStep.title,
    });

    completionTimerRef.current = setTimeout(() => {
      setCompletionNotice(null);
      setOpen(true);
      completionTimerRef.current = null;
    }, ONBOARDING_COMPLETION_NOTICE_MS);
  }, [progress]);

  useEffect(
    () => () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setOnboardingNotificationsPanelOpen(open);

    return () => {
      setOnboardingNotificationsPanelOpen(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
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

  if (!session || isPlatformOnlySession(session)) {
    return null;
  }

  const triggerClass = isBrand
    ? "group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-surface-card hover:text-[#f8fafc]"
    : isSidebar
      ? "group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-black bg-surface-card px-3 py-2.5 text-left transition-colors hover:bg-[#2f3834]"
      : "group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card text-slate-300 transition hover:bg-[#2f3834] hover:text-[#f8fafc]";

  const popover =
    open && panelPosition ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificaciones"
        data-onboarding-notifications-panel=""
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
                {hasActiveTutorial ? (
                  <>
                    <p className={labelMutedClass}>Tutorial paso a paso</p>
                    <h2 className="text-base font-black text-[#f8fafc]">Tareas iniciales</h2>
                  </>
                ) : (
                  <>
                    <p className={labelMutedClass}>Centro de avisos</p>
                    <h2 className="text-base font-black text-[#f8fafc]">Notificaciones</h2>
                    <p className="mt-0.5 text-xs font-bold leading-snug text-slate-400">
                      Guías y pendientes para tu operación diaria.
                    </p>
                  </>
                )}
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

          {hasPausedTutorial ? (
            <div className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-sky-700/30 bg-sky-400/10 px-2 py-1 text-[10px] font-black text-sky-200">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
              Tutorial disponible
            </div>
          ) : hasActiveTutorial ? (
            <div className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-200">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
              Configuración inicial en curso
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {hasPausedTutorial && session?.organizationId ? (
            <OnboardingStartPanel organizationId={session.organizationId} />
          ) : null}

          {hasActiveTutorial ? (
            <OnboardingPanel
              progress={progress}
              loading={loading}
              error={error}
              onNavigate={close}
            />
          ) : null}

          {ready && !hasOnboarding ? <NotificationsEmptyState /> : null}
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
      {mounted && completionNotice
        ? createPortal(
            <div
              className="pointer-events-none fixed left-1/2 top-5 z-[490] w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 rounded-xl border border-emerald-500/45 bg-[#102018]/95 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">
                    Paso completado
                  </p>
                  <p className="text-sm font-black text-[#f8fafc]">
                    {completionNotice.completedTitle} listo
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-slate-300">
                    Siguiente: {completionNotice.nextTitle}
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
