"use client";

import {
  Building2,
  CircleDollarSign,
  Home,
  MapPinCheck,
  Package,
  PackageCheck,
  Plane,
  Receipt,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ShipmentRow, ShipmentStatus } from "@/app/actions/shipments";
import {
  legHasScheduleChange,
  planLegRecord,
  type LogisticsLegKey,
} from "@/lib/shipment-schedule-history";
import {
  EMPTY_BOX_LEG_LABELS,
  FULL_BOX_LEG_LABELS,
} from "@/lib/shipment-leg-labels";
import type { ShipmentAuditContext } from "@/lib/shipment-audit";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
} from "@/components/sale/venta-parts";
import {
  ShipmentStepContextMenu,
  isLogisticsLegKind,
  isStatusStepKind,
  logisticsLegMenuSummary,
  statusForProgressKind,
  type ShipmentStepMenuState,
} from "@/components/shipment-step-context-menu";
import { ShipmentStepDetailPanel } from "@/components/shipment-step-detail-panel";
import {
  emptyBoxLegLockReason,
  emptyBoxLegLocked,
  fullBoxLegLockReason,
  fullBoxLegLocked,
  shipmentLogisticsEditorState,
  type ShipmentLogisticsEditorState,
} from "@/lib/shipment-logistics-edit";
import type {
  ShipmentProgressChannel,
  ShipmentProgressKind,
  ShipmentProgressStep,
} from "@/lib/shipment-display";
import {
  saleAgeTextClass,
  stepShortName,
  stepTimingTooltip,
  type ShipmentTimings,
} from "@/lib/shipment-timing";

type ShipmentProgressStepsProps = {
  steps: ShipmentProgressStep[];
  timings?: ShipmentTimings;
  row?: ShipmentRow;
  canEdit?: boolean;
  canEditLogistics?: boolean;
  canEditStatus?: boolean;
  saving?: boolean;
  compact?: boolean;
  singleLine?: boolean;
  onLogisticsPatch?: (patch: Partial<ShipmentLogisticsEditorState>, audit: ShipmentAuditContext) => void;
  onStatusChange?: (status: ShipmentStatus, audit: ShipmentAuditContext) => void;
  onFullBoxReceivedAtOffice?: (audit: ShipmentAuditContext) => void;
  onLockedLeg?: (message: string) => void;
};

function stepDotClass(state: ShipmentProgressStep["state"]) {
  if (state === "done") {
    return "border-emerald-600 bg-emerald-400 text-slate-950";
  }

  if (state === "active") {
    return "border-amber-500 bg-amber-400 text-slate-950";
  }

  return "border-black bg-surface-inset text-slate-500";
}

function timelineRowClass(state: ShipmentProgressStep["state"], interactive: boolean, compact: boolean) {
  const base = compact ? "rounded px-1 py-0 transition" : "rounded-lg px-2 py-1.5 transition";

  if (state === "active") {
    return `${base} bg-amber-950/30`;
  }

  if (state === "pending") {
    return `${base} opacity-55`;
  }

  if (interactive) {
    return `${base} cursor-pointer hover:bg-surface-inset/60`;
  }

  return base;
}

function timelineLineClass(state: ShipmentProgressStep["state"]) {
  return state === "done" ? "bg-emerald-500/70" : "bg-surface-inset";
}

function stepIcon(kind: ShipmentProgressKind, channel: ShipmentProgressChannel): LucideIcon {
  if (kind === "sale") {
    return Receipt;
  }

  if (kind === "payment") {
    return CircleDollarSign;
  }

  if (kind === "empty_box") {
    if (channel === "home") {
      return Truck;
    }

    return channel === "office" ? Store : Package;
  }

  if (kind === "full_box") {
    if (channel === "home") {
      return Home;
    }

    return PackageCheck;
  }

  if (kind === "office") {
    return Building2;
  }

  if (kind === "pickup") {
    return Truck;
  }

  if (kind === "transit") {
    return Plane;
  }

  return MapPinCheck;
}

function compactLogisticsLegUsesOutline(step: ShipmentProgressStep) {
  if (step.state !== "active") {
    return false;
  }

  if (step.kind !== "empty_box" && step.kind !== "full_box") {
    return false;
  }

  return !step.driverTaskOrdered;
}

function compactStepClass(
  step: ShipmentProgressStep,
  isDetailOpen: boolean,
) {
  const detailRing = isDetailOpen
    ? "z-10 ring-2 ring-emerald-400 ring-offset-1 ring-offset-surface-card shadow-[0_0_10px_rgba(52,211,153,0.45)]"
    : "";
  const activePulse = step.state === "active" ? "shipment-step-active-pulse border-amber-500" : "";
  const activeOutlineClass = `border-amber-500 bg-surface-card-header text-amber-100 ${detailRing} ${activePulse}`;

  if (compactLogisticsLegUsesOutline(step)) {
    return activeOutlineClass;
  }

  if (step.state === "done") {
    return `border-emerald-700 bg-emerald-400/90 text-slate-950 ${detailRing}`;
  }

  if (step.state === "active") {
    return `border-amber-600 bg-amber-400 text-slate-950 ${detailRing} ${activePulse}`;
  }

  return `border-black bg-surface-card-header text-slate-500 ${detailRing}`;
}

function compactStepName(kind: ShipmentProgressKind) {
  if (kind === "empty_box") {
    return EMPTY_BOX_LEG_LABELS.short;
  }

  if (kind === "full_box") {
    return FULL_BOX_LEG_LABELS.short;
  }

  if (kind === "pickup") {
    return "Salida";
  }

  return stepShortName(kind);
}

function legLockReason(row: ShipmentRow, kind: ShipmentProgressKind) {
  if (kind === "empty_box") {
    return emptyBoxLegLocked(row) ? emptyBoxLegLockReason(row) : "";
  }

  if (kind === "full_box") {
    return fullBoxLegLocked(row) ? fullBoxLegLockReason(row) : "";
  }

  return "";
}

export function stepIsReachable(step: ShipmentProgressStep) {
  return step.state === "active" || step.state === "done";
}

function toggleLegPatch(
  state: ShipmentLogisticsEditorState,
  kind: "empty_box" | "full_box",
): Partial<ShipmentLogisticsEditorState> {
  if (kind === "empty_box") {
    const toDriver = state.emptyBoxMode === EMPTY_BOX_OFFICE_MODE;

    return {
      emptyBoxMode: toDriver ? EMPTY_BOX_DRIVER_MODE : EMPTY_BOX_OFFICE_MODE,
      emptyBoxHandingNow: toDriver ? false : state.emptyBoxHandingNow,
      emptyBoxScheduleMode: toDriver ? state.emptyBoxScheduleMode || "pending" : "pending",
      emptyBoxScheduleAt: toDriver ? state.emptyBoxScheduleAt : "",
    };
  }

  const toDriver = state.fullBoxMode === FULL_BOX_OFFICE_MODE;

  return {
    fullBoxMode: toDriver ? FULL_BOX_DRIVER_MODE : FULL_BOX_OFFICE_MODE,
    fullBoxScheduleMode: toDriver ? state.fullBoxScheduleMode || "pending" : "pending",
    fullBoxScheduleAt: toDriver ? state.fullBoxScheduleAt : "",
  };
}

export function ShipmentProgressSteps({
  steps,
  timings,
  row,
  canEdit = false,
  canEditLogistics,
  canEditStatus,
  saving = false,
  compact = false,
  singleLine = false,
  onLogisticsPatch,
  onStatusChange,
  onFullBoxReceivedAtOffice,
  onLockedLeg,
}: ShipmentProgressStepsProps) {
  const [menu, setMenu] = useState<ShipmentStepMenuState>(null);
  const [detailStepId, setDetailStepId] = useState<string | null>(null);
  const [detailAnchor, setDetailAnchor] = useState<DOMRect | null>(null);
  const [detailStepAnchor, setDetailStepAnchor] = useState<DOMRect | null>(null);
  const progressCardRef = useRef<HTMLDivElement>(null);
  const stepButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const editorState = row ? shipmentLogisticsEditorState(row) : null;
  const logisticsEditable = canEditLogistics ?? canEdit;
  const statusEditable = canEditStatus ?? canEdit;

  function stepAllowsEdit(step: ShipmentProgressStep) {
    if (isLogisticsLegKind(step.kind)) {
      return logisticsEditable;
    }

    if (isStatusStepKind(step.kind)) {
      return statusEditable;
    }

    return false;
  }

  function menuLockReason(kind: ShipmentProgressKind) {
    if (isLogisticsLegKind(kind) && !logisticsEditable) {
      return "Sin permiso para cambiar esta etapa";
    }

    if (isStatusStepKind(kind) && !statusEditable) {
      return "Sin permiso para cambiar el estado";
    }

    if (!row || !isLogisticsLegKind(kind)) {
      return "";
    }

    return legLockReason(row, kind);
  }

  function menuLegContext(kind: ShipmentProgressKind) {
    if (!editorState || !isLogisticsLegKind(kind)) {
      return {
        currentLegMode: "",
        legOrdered: false,
        currentSummary: "",
      };
    }

    const taskType = kind === "empty_box" ? "deliver_empty_box" : "pickup_full_box";
    const legOrdered = Boolean(
      row?.logisticsTasks.some(
        (task) => task.taskType === taskType && task.status !== "cancelled",
      ),
    );

    return {
      currentLegMode: kind === "empty_box" ? editorState.emptyBoxMode : editorState.fullBoxMode,
      legOrdered,
      emptyBoxHandingNow: editorState.emptyBoxHandingNow,
      currentSummary: logisticsLegMenuSummary(kind, editorState),
      scheduleChanged: legHasScheduleChange(
        planLegRecord(row?.logistics_plan, (kind === "empty_box" ? "emptyBox" : "fullBox") as LogisticsLegKey),
      ),
    };
  }

  const syncDetailAnchors = useCallback((stepId: string | null = detailStepId) => {
    setDetailAnchor(progressCardRef.current?.getBoundingClientRect() ?? null);
    setDetailStepAnchor(
      stepId ? stepButtonRefs.current[stepId]?.getBoundingClientRect() ?? null : null,
    );
  }, [detailStepId]);

  function shouldOpenLegMenuOnClick(step: ShipmentProgressStep) {
    return (step.kind === "empty_box" || step.kind === "full_box") && step.state === "active";
  }

  function openStepMenu(
    step: ShipmentProgressStep,
    x: number,
    y: number,
    trigger: "left_click" | "context_menu",
  ) {
    setMenu({
      kind: step.kind,
      title: step.title,
      x,
      y,
      trigger,
    });
  }

  function openStepMenuFromButton(
    step: ShipmentProgressStep,
    stepId: string,
    fallbackEvent?: React.MouseEvent,
  ) {
    const rect = stepButtonRefs.current[stepId]?.getBoundingClientRect();

    openStepMenu(
      step,
      rect ? Math.min(rect.left, window.innerWidth - 300) : fallbackEvent?.clientX ?? 0,
      rect ? rect.bottom + 6 : fallbackEvent?.clientY ?? 0,
      "left_click",
    );
  }

  function handleLeftClick(step: ShipmentProgressStep, event?: React.MouseEvent) {
    if (!stepIsInteractive(step)) {
      return;
    }

    if (!stepAllowsEdit(step) || saving || !row) {
      return;
    }

    if (isLogisticsLegKind(step.kind)) {
      if (shouldOpenLegMenuOnClick(step)) {
        if (event) {
          openStepMenu(step, event.clientX, event.clientY, "left_click");
        }
        return;
      }

      const lock = legLockReason(row, step.kind);
      if (lock) {
        onLockedLeg?.(lock);
        return;
      }

      if (!editorState) {
        return;
      }

      onLogisticsPatch?.(toggleLegPatch(editorState, step.kind), {
        interaction: "left_click",
        source: "envios.progress",
        stepTitle: step.title,
        stepKind: step.kind,
      });
      return;
    }

    if (isStatusStepKind(step.kind)) {
      const status = statusForProgressKind(step.kind);
      if (status) {
        onStatusChange?.(status, {
          interaction: "left_click",
          source: "envios.progress",
          stepTitle: step.title,
          stepKind: step.kind,
        });
      }
    }
  }

  function handleContextMenu(event: React.MouseEvent, step: ShipmentProgressStep) {
    if (!stepIsInteractive(step)) {
      return;
    }

    if (!stepAllowsEdit(step) || saving || !row) {
      return;
    }

    if (!isLogisticsLegKind(step.kind) && !isStatusStepKind(step.kind)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setMenu({
      kind: step.kind,
      title: step.title,
      x: event.clientX,
      y: event.clientY,
      trigger: "context_menu",
    });
  }

  const activeMenuKind = menu?.kind;
  const menuScheduleMode =
    activeMenuKind === "empty_box"
      ? editorState?.emptyBoxScheduleMode || "pending"
      : activeMenuKind === "full_box"
        ? editorState?.fullBoxScheduleMode || "pending"
        : "pending";
  const menuScheduleAt =
    activeMenuKind === "empty_box"
      ? editorState?.emptyBoxScheduleAt || ""
      : activeMenuKind === "full_box"
        ? editorState?.fullBoxScheduleAt || ""
        : "";

  function stepIsInteractive(step: ShipmentProgressStep) {
    return stepAllowsEdit(step) && !saving && Boolean(row) && stepIsReachable(step);
  }

  function openContextMenu(event: React.MouseEvent, step: ShipmentProgressStep) {
    if (!stepIsInteractive(step)) {
      return;
    }

    handleContextMenu(event, step);
  }

  const activeStep = steps.find((step) => step.state === "active") ?? steps[steps.length - 1];
  const detailStep = detailStepId ? steps.find((step) => step.id === detailStepId) : null;
  const detailStepNumber = detailStep ? steps.findIndex((step) => step.id === detailStep.id) + 1 : 0;

  useLayoutEffect(() => {
    if (!detailStepId) {
      return;
    }

    syncDetailAnchors(detailStepId);

    function handleViewportChange() {
      syncDetailAnchors(detailStepId);
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [detailStepId, syncDetailAnchors]);

  const detailPanel =
    row && detailStep ? (
      <ShipmentStepDetailPanel
        row={row}
        step={detailStep}
        stepNumber={detailStepNumber}
        totalSteps={steps.length}
        timings={timings}
        anchorRect={detailAnchor}
        stepAnchorRect={detailStepAnchor}
        onClose={() => setDetailStepId(null)}
      />
    ) : null;

  const contextMenuPanel =
    row && menu ? (
      <ShipmentStepContextMenu
        menu={menu}
        lockReason={menuLockReason(menu.kind)}
        scheduleMode={menuScheduleMode}
        scheduleAt={menuScheduleAt}
        {...menuLegContext(menu.kind)}
        currentStatus={row.status}
        onClose={() => setMenu(null)}
        onApply={(patch) => {
          onLogisticsPatch?.(patch, {
            interaction: "context_menu",
            source: "envios.progress",
            stepTitle: menu.title,
            stepKind: menu.kind,
          });
          setMenu(null);
        }}
        onStatusChange={(status) => {
          onStatusChange?.(status, {
            interaction: "context_menu",
            source: "envios.progress",
            stepTitle: menu.title,
            stepKind: menu.kind,
          });
        }}
        onFullBoxReceivedAtOffice={() => {
          onFullBoxReceivedAtOffice?.({
            interaction: "context_menu",
            source: "envios.progress",
            stepTitle: menu.title,
            stepKind: menu.kind,
          });
        }}
      />
    ) : null;

  if (compact) {
    const waiting = activeStep?.state === "active";
    const focusStep = waiting ? activeStep : steps.filter((step) => step.state === "done").at(-1) ?? activeStep;
    const panelTint = waiting
      ? timings?.isLongWait
        ? "border-amber-500/60 bg-amber-950/20"
        : "border-black bg-surface-inset"
      : "border-emerald-600/40 bg-emerald-950/15";
    const stepButtonClass = singleLine
      ? "relative flex h-9 w-full min-w-0 items-center gap-1 rounded border px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      : "relative flex h-10 min-w-0 items-center gap-1.5 rounded border px-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50";
    const stepLabelClass = singleLine
      ? "min-w-0 truncate text-[11px] font-black leading-none"
      : "min-w-0 truncate text-[11px] font-black leading-tight";
    const stepIconWrapClass = singleLine ? "h-4 w-4" : "h-5 w-5";
    const stepIconClass = singleLine ? "h-3 w-3" : "h-3.5 w-3.5";

    const stepButtons = steps.map((step) => {
      const isDetailOpen = detailStepId === step.id;
      const Icon = stepIcon(step.kind, step.channel);

      return (
        <button
          type="button"
          key={step.id}
          disabled={!stepIsInteractive(step)}
          ref={(element) => {
            stepButtonRefs.current[step.id] = element;
          }}
          title={timings ? stepTimingTooltip(step) : step.title}
          onClick={(event) => {
            event.stopPropagation();
            if (!stepIsReachable(step)) {
              return;
            }

            if (shouldOpenLegMenuOnClick(step) && stepIsInteractive(step)) {
              openStepMenuFromButton(step, step.id, event);
              setDetailStepId(null);
              return;
            }

            const nextStepId = detailStepId === step.id ? null : step.id;
            setDetailStepId(nextStepId);
            if (nextStepId) {
              queueMicrotask(() => syncDetailAnchors(nextStepId));
            } else {
              setDetailStepAnchor(null);
            }
          }}
          onContextMenu={(event) => openContextMenu(event, step)}
          className={`${stepButtonClass} ${stepIsInteractive(step) ? "hover:opacity-90" : ""} ${compactStepClass(step, isDetailOpen)}`}
          aria-label={step.title}
          aria-expanded={isDetailOpen}
          aria-current={step.state === "active" ? "step" : undefined}
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded border border-black/30 bg-black/10 ${stepIconWrapClass}`}
          >
            <Icon className={stepIconClass} strokeWidth={2.25} aria-hidden />
          </span>
          <span className={stepLabelClass}>{compactStepName(step.kind)}</span>
          {isDetailOpen ? (
            <span
              className="pointer-events-none absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-emerald-400"
              aria-hidden
            />
          ) : null}
        </button>
      );
    });

    if (singleLine) {
      return (
        <>
          <div
            ref={progressCardRef}
            onContextMenu={(event) => {
              if (focusStep) {
                openContextMenu(event, focusStep);
              }
            }}
            title={focusStep && stepIsInteractive(focusStep) ? "Clic derecho: más opciones" : undefined}
            className={`relative w-full max-w-full min-w-0 rounded-lg border px-1.5 py-1 [contain:paint] ${panelTint}`}
          >
            <div
              className="grid w-full max-w-full gap-1"
              style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
              {stepButtons}
            </div>
          </div>

          {detailPanel}

          {contextMenuPanel}
        </>
      );
    }

    const focusIndex = focusStep ? steps.findIndex((step) => step.id === focusStep.id) + 1 : 0;

    return (
      <>
        <div className="min-w-0">
          <div
            ref={progressCardRef}
            onContextMenu={(event) => {
              if (focusStep) {
                openContextMenu(event, focusStep);
              }
            }}
            title={focusStep && stepIsInteractive(focusStep) ? "Clic derecho: más opciones" : undefined}
            className={`relative rounded-lg border p-2.5 [contain:paint] ${panelTint}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="inline-flex max-w-full items-center rounded border border-black bg-surface-card-header px-2 py-1 text-[10px] font-black uppercase leading-none text-slate-400">
                  Paso {focusIndex || steps.length} de {steps.length}
                </p>
              </div>
              {timings?.saleAgeLabel ? (
                <p
                  className={`truncate text-[10px] font-black ${saleAgeTextClass(timings.saleAgeMs)}`}
                >
                  {timings.saleAgeLabel}
                </p>
              ) : null}
            </div>

            <div
              className="mt-2 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
              {stepButtons}
            </div>
          </div>
        </div>

        {detailPanel}

        {contextMenuPanel}
      </>
    );
  }

  return (
    <>
      <ol className="relative m-0 list-none p-0">
        {steps.map((step, index) => {
          const Icon = stepIcon(step.kind, step.channel);
          const interactive = stepIsInteractive(step);
          const DotTag = interactive ? "button" : "span";

          return (
            <li key={step.id} className="relative flex gap-3">
              <div className="flex w-8 shrink-0 flex-col items-center">
                <DotTag
                  type={interactive ? "button" : undefined}
                  onClick={
                    interactive
                      ? (event) => handleLeftClick(step, event)
                      : undefined
                  }
                  onContextMenu={(event) => openContextMenu(event, step)}
                  title={
                    interactive
                      ? isLogisticsLegKind(step.kind)
                        ? step.kind === "full_box" && step.state === "active"
                          ? `Programar o marcar ${FULL_BOX_LEG_LABELS.short.toLowerCase()}`
                          : step.kind === "empty_box" && step.state === "active"
                            ? `Programar o marcar ${EMPTY_BOX_LEG_LABELS.short.toLowerCase()}`
                            : "Clic: alternar oficina / domicilio · Clic derecho: más opciones"
                        : "Clic: marcar estado · Clic derecho: elegir otro"
                      : undefined
                  }
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${stepDotClass(step.state)} ${interactive ? "cursor-pointer hover:brightness-110" : ""}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </DotTag>
                {index < steps.length - 1 ? (
                  <div
                    className={`my-1 w-0.5 flex-1 min-h-[1.25rem] rounded-full ${timelineLineClass(step.state)}`}
                    aria-hidden
                  />
                ) : null}
              </div>

              <div
                className={`mb-3 min-w-0 flex-1 ${timelineRowClass(step.state, interactive, false)}`}
                onClick={interactive ? (event) => handleLeftClick(step, event) : undefined}
                onContextMenu={interactive ? (event) => openContextMenu(event, step) : undefined}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p
                    className={`text-sm font-black ${step.state === "active" ? "text-amber-100" : step.state === "done" ? "text-emerald-200" : "text-slate-400"}`}
                  >
                    {step.title}
                  </p>
                  {step.channelLabel ? (
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      {step.channelLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs font-bold leading-snug text-slate-300">{step.detail}</p>
                {step.scheduleChanged ? (
                  <span className="mt-1 inline-flex rounded border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-200">
                    Fecha modificada
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {contextMenuPanel}
    </>
  );
}
