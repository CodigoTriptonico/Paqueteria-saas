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
import { useState } from "react";
import type { ShipmentRow, ShipmentStatus } from "@/app/actions/shipments";
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
  stepTimingTooltip,
  type ShipmentTimings,
} from "@/lib/shipment-timing";

type ShipmentProgressStepsProps = {
  steps: ShipmentProgressStep[];
  timings?: ShipmentTimings;
  row?: ShipmentRow;
  canEdit?: boolean;
  saving?: boolean;
  compact?: boolean;
  onLogisticsPatch?: (patch: Partial<ShipmentLogisticsEditorState>, audit: ShipmentAuditContext) => void;
  onStatusChange?: (status: ShipmentStatus, audit: ShipmentAuditContext) => void;
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

function legLockReason(row: ShipmentRow, kind: ShipmentProgressKind) {
  if (kind === "empty_box") {
    return emptyBoxLegLocked(row) ? emptyBoxLegLockReason(row) : "";
  }

  if (kind === "full_box") {
    return fullBoxLegLocked(row) ? fullBoxLegLockReason(row) : "";
  }

  return "";
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
  saving = false,
  compact = false,
  onLogisticsPatch,
  onStatusChange,
  onLockedLeg,
}: ShipmentProgressStepsProps) {
  const [menu, setMenu] = useState<ShipmentStepMenuState>(null);
  const [detailStepId, setDetailStepId] = useState<string | null>(null);
  const editorState = row ? shipmentLogisticsEditorState(row) : null;

  function handleLeftClick(step: ShipmentProgressStep) {
    if (!canEdit || saving || !row) {
      return;
    }

    if (isLogisticsLegKind(step.kind)) {
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
    if (!canEdit || saving || !row) {
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
    return (
      canEdit &&
      !saving &&
      Boolean(row) &&
      (isLogisticsLegKind(step.kind) || isStatusStepKind(step.kind))
    );
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

  if (compact) {
    const waiting = activeStep?.state === "active";
    const focusStep = waiting ? activeStep : steps.filter((step) => step.state === "done").at(-1) ?? activeStep;
    const panelTint = waiting
      ? timings?.isLongWait
        ? "border-amber-500/60 bg-amber-950/20"
        : "border-black bg-surface-inset"
      : "border-emerald-600/40 bg-emerald-950/15";
    const waitingText = waiting ? timings?.waitingText || "" : "";

    return (
      <>
        <div className="min-w-0">
          <div
            onContextMenu={(event) => {
              if (focusStep) {
                openContextMenu(event, focusStep);
              }
            }}
            title={focusStep && stepIsInteractive(focusStep) ? "Clic derecho: más opciones" : undefined}
            className={`relative rounded-lg border p-2.5 ${panelTint}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex h-6 items-center rounded border border-black bg-surface-card-header px-2 text-[10px] font-black uppercase leading-none text-slate-400">
                {timings?.progressStepLabel || "Progreso"}
              </p>
              {timings?.saleAgeLabel ? (
                <p className="truncate text-[10px] font-black text-slate-500">{timings.saleAgeLabel}</p>
              ) : null}
            </div>

            <div
              className="mt-2 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
              {steps.map((step, index) => (
                <button
                  type="button"
                  key={step.id}
                  title={timings ? stepTimingTooltip(step, timings) : step.title}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDetailStepId((current) => (current === step.id ? null : step.id));
                  }}
                  onContextMenu={(event) => openContextMenu(event, step)}
                  className={`flex h-6 min-w-0 items-center justify-center rounded border text-[10px] font-black tabular-nums transition hover:brightness-110 ${
                    step.state === "done"
                      ? "border-emerald-700 bg-emerald-400 text-slate-950"
                      : step.state === "active"
                        ? "border-amber-700 bg-amber-400 text-slate-950"
                        : "border-black bg-surface-card-header text-slate-500"
                  }`}
                  aria-label={step.title}
                  aria-expanded={detailStepId === step.id}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {row && detailStep ? (
              <ShipmentStepDetailPanel
                row={row}
                step={detailStep}
                stepNumber={detailStepNumber}
                totalSteps={steps.length}
                timings={timings}
                onClose={() => setDetailStepId(null)}
              />
            ) : null}

            {focusStep ? (
              <div className="mt-2 min-w-0 border-t border-black/40 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Ahora</p>
                  {focusStep.channelLabel ? (
                    <p className="truncate text-[10px] font-black uppercase text-slate-500">
                      {focusStep.channelLabel}
                    </p>
                  ) : null}
                </div>

                <p
                  className={`mt-1 text-base font-black leading-snug ${
                    waiting ? "text-amber-100" : "text-emerald-200"
                  }`}
                >
                  {focusStep.title}
                </p>

                {waitingText ? (
                  <p className="mt-1 text-lg font-black tabular-nums leading-tight text-amber-100">
                    {waitingText}
                  </p>
                ) : null}

                {!waiting && focusStep.state === "done" ? (
                  <p className="mt-1 text-[11px] font-bold text-emerald-200/80">Completado</p>
                ) : null}

                {focusStep.detail ? (
                  <p className="mt-2 rounded border border-black/40 bg-surface-card-header px-2 py-1.5 text-[11px] font-bold leading-snug text-slate-300">
                    <span className="font-black uppercase text-slate-500">Acción:</span>{" "}
                    {focusStep.detail}
                  </p>
                ) : null}
              </div>
            ) : null}

            {timings?.lastCompletedGap ? (
              <p className="mt-2 border-t border-black/30 pt-1.5 text-[10px] font-bold leading-snug text-slate-500">
                <span className="text-slate-600">Último tramo:</span> {timings.lastCompletedGap}
              </p>
            ) : null}
          </div>
        </div>

        {row && menu ? (
          <ShipmentStepContextMenu
            menu={menu}
            lockReason={isLogisticsLegKind(menu.kind) ? legLockReason(row, menu.kind) : ""}
            scheduleMode={menuScheduleMode}
            scheduleAt={menuScheduleAt}
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
          />
        ) : null}
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
                  onClick={interactive ? () => handleLeftClick(step) : undefined}
                  onContextMenu={(event) => openContextMenu(event, step)}
                  title={
                    interactive
                      ? isLogisticsLegKind(step.kind)
                        ? "Clic: alternar oficina / domicilio · Clic derecho: más opciones"
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
                onClick={() => handleLeftClick(step)}
                onContextMenu={(event) => openContextMenu(event, step)}
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
              </div>
            </li>
          );
        })}
      </ol>

      {row && menu ? (
        <ShipmentStepContextMenu
          menu={menu}
          lockReason={isLogisticsLegKind(menu.kind) ? legLockReason(row, menu.kind) : ""}
          scheduleMode={menuScheduleMode}
          scheduleAt={menuScheduleAt}
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
        />
      ) : null}
    </>
  );
}
