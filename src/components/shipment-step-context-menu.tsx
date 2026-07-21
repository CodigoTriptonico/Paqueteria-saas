"use client";

import {
  Building2,
  MapPinCheck,
  Plane,
  Route,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ShipmentStatus } from "@/app/actions/shipments";
import { ActionConfirmDialog } from "@/components/action-confirm-dialog";
import { ContextMenuFlyout } from "@/components/context-menu-flyout";
import { formatScheduleAtDisplay } from "@/lib/sale/schedule-time";
import {
  deliverySummary,
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
  emptyBoxOfficeSummary,
  fullBoxSummaryLine,
} from "@/components/sale/venta-parts";
import type { ShipmentProgressKind } from "@/lib/shipment-display";
import {
  EMPTY_BOX_LEG_LABELS,
  FULL_BOX_LEG_LABELS,
} from "@/lib/shipment-leg-labels";
import type { ShipmentLogisticsEditorState } from "@/lib/shipment-logistics-edit";
import { logisticsLegCancelCopy } from "@/lib/shipment-leg-cancel-confirm";
import { shouldSuppressDismissForNativePicker } from "@/lib/native-picker";

export type ShipmentStepMenuState = {
  kind: ShipmentProgressKind;
  title: string;
  x: number;
  y: number;
  trigger: "left_click" | "context_menu";
} | null;

type ShipmentStepContextMenuProps = {
  menu: ShipmentStepMenuState;
  lockReason?: string;
  scheduleMode: string;
  scheduleAt: string;
  currentLegMode?: string;
  legOrdered?: boolean;
  scheduleChanged?: boolean;
  emptyBoxHandingNow?: boolean;
  currentSummary?: string;
  currentStatus?: ShipmentStatus;
  onClose: () => void;
  onApply: (patch: Partial<ShipmentLogisticsEditorState>) => void;
  onStatusChange?: (status: ShipmentStatus) => void;
  onFullBoxReceivedAtOffice?: () => void;
  onProgramRoute?: (kind: "empty_box" | "full_box") => void;
};

export function scheduleApplyButtonLabel(hasExistingSchedule: boolean) {
  return hasExistingSchedule ? "Cambiar fecha" : "Aplicar programación";
}

function DriverLegReadyMenu({
  readyLabel,
  cancelLabel,
  scheduleDetail,
  scheduleChanged = false,
  legOrdered,
  locked,
  onCancel,
  onProgramRoute,
}: {
  readyLabel: string;
  cancelLabel: string;
  scheduleDetail?: string;
  scheduleChanged?: boolean;
  legOrdered: boolean;
  locked: boolean;
  onCancel: () => void;
  onProgramRoute?: () => void;
}) {
  return (
    <div className="grid gap-2">
      {onProgramRoute ? (
        <button
          type="button"
          disabled={locked}
          onClick={onProgramRoute}
          className="flex w-full items-center gap-3 rounded-lg border border-emerald-800/60 bg-emerald-950/20 px-3 py-2.5 text-left hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-emerald-300">
            <Route className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-emerald-100">{readyLabel}</span>
            <span className="mt-0.5 block text-[11px] font-bold leading-snug text-slate-400">
              Eliges la ruta (día) y la hora. Si no la sabes, déjala pendiente de ruta.
            </span>
            {scheduleDetail ? (
              <span className="mt-1 block text-[11px] font-bold text-slate-500">{scheduleDetail}</span>
            ) : null}
            {scheduleChanged ? (
              <span className="mt-1 inline-flex rounded border border-amber-700/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-200">
                Fecha modificada
              </span>
            ) : null}
          </span>
        </button>
      ) : null}
      {legOrdered ? (
        <button
          type="button"
          disabled={locked}
          onClick={onCancel}
          className="flex w-full items-center gap-3 rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2.5 text-left hover:bg-rose-950/35 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-rose-300">
            <X className="h-5 w-5" />
          </span>
          <span className="text-sm font-black text-rose-100">{cancelLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

export function logisticsLegMenuSummary(
  kind: "empty_box" | "full_box",
  state: ShipmentLogisticsEditorState,
) {
  if (kind === "empty_box") {
    if (state.emptyBoxMode === EMPTY_BOX_OFFICE_MODE) {
      return state.emptyBoxHandingNow
        ? emptyBoxOfficeSummary()
        : "Cliente recoge caja vacía en oficina";
    }

    return deliverySummary(
      state.emptyBoxMode,
      state.emptyBoxScheduleMode,
      state.emptyBoxScheduleAt,
    );
  }

  return fullBoxSummaryLine(
    state.fullBoxMode,
    state.fullBoxScheduleMode,
    state.fullBoxScheduleAt,
  );
}

export function logisticsLegActiveChannel(
  kind: "empty_box" | "full_box",
  state: ShipmentLogisticsEditorState,
) {
  const mode = kind === "empty_box" ? state.emptyBoxMode : state.fullBoxMode;
  const officeMode = kind === "empty_box" ? EMPTY_BOX_OFFICE_MODE : FULL_BOX_OFFICE_MODE;
  const driverMode = kind === "empty_box" ? EMPTY_BOX_DRIVER_MODE : FULL_BOX_DRIVER_MODE;

  if (mode === officeMode) {
    return "office" as const;
  }

  if (mode === driverMode) {
    return "driver" as const;
  }

  return "unset" as const;
}

const STATUS_MENU_OPTIONS: Array<{ status: ShipmentStatus; label: string; icon: ReactNode }> = [
  { status: "En oficina", label: "En oficina", icon: <Building2 className="h-4 w-4" /> },
  { status: "Pickup", label: "Salida", icon: <Truck className="h-4 w-4" /> },
  { status: "Enviado", label: "En tránsito", icon: <Plane className="h-4 w-4" /> },
  { status: "Entregado", label: "Entregado", icon: <MapPinCheck className="h-4 w-4" /> },
];

function CurrentOptionBanner({ label }: { label: string }) {
  return (
    <div className="mt-1 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2">
      <p className="text-[10px] font-black uppercase text-emerald-400/90">Opción actual</p>
      <p className="mt-0.5 text-sm font-black leading-snug text-emerald-100">{label}</p>
    </div>
  );
}

function FlyoutStatusButton({
  label,
  detail,
  icon,
  onClick,
}: {
  label: string;
  detail?: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-black hover:bg-surface-card"
    >
      <span className="mt-0.5 text-emerald-300">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#f8fafc]">{label}</span>
        {detail ? (
          <span className="mt-0.5 block text-xs font-bold text-slate-400">{detail}</span>
        ) : null}
      </span>
    </button>
  );
}

export function ShipmentStepContextMenu({
  menu,
  lockReason,
  scheduleMode,
  scheduleAt,
  currentLegMode = "",
  legOrdered = false,
  scheduleChanged = false,
  currentSummary = "",
  currentStatus,
  onClose,
  onApply,
  onStatusChange,
  onFullBoxReceivedAtOffice,
  onProgramRoute,
}: ShipmentStepContextMenuProps) {
  const [scheduleConfirm, setScheduleConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: "warning" | "danger";
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!menu) {
      queueMicrotask(() => setScheduleConfirm(null));
    }
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    function closeOnPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const menu = document.getElementById("shipment-step-context-menu");

      if (menu?.contains(target)) {
        return;
      }

      if (document.getElementById("shipment-step-schedule-confirm")?.contains(target)) {
        return;
      }

      if (shouldSuppressDismissForNativePicker(event, menu)) {
        return;
      }

      onClose();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu, onClose]);

  if (!menu) {
    return null;
  }

  const locked = Boolean(lockReason);
  const isEmpty = menu.kind === "empty_box";
  const isFull = menu.kind === "full_box";
  const isStatusMenu = isStatusStepKind(menu.kind);
  const officeMode = isEmpty ? EMPTY_BOX_OFFICE_MODE : FULL_BOX_OFFICE_MODE;
  const driverMode = isEmpty ? EMPTY_BOX_DRIVER_MODE : FULL_BOX_DRIVER_MODE;
  const activeChannel =
    currentLegMode === officeMode
      ? "office"
      : currentLegMode === driverMode
        ? "driver"
        : "unset";
  const isDriverActive = activeChannel === "driver";
  const scheduleDetail =
    scheduleMode === "scheduled" && scheduleAt
      ? `Programado · ${formatScheduleAtDisplay(scheduleAt)}`
      : isDriverActive
        ? isFull
          ? "Sin fecha aún"
          : "Chofer — sin fecha aún"
        : undefined;

  const legShortLabel = isEmpty ? EMPTY_BOX_LEG_LABELS.short : FULL_BOX_LEG_LABELS.short;

  function applyOfficeDelivery() {
    if (isEmpty) {
      onApply({
        emptyBoxMode: officeMode,
        emptyBoxHandingNow: true,
        emptyBoxScheduleMode: "pending",
        emptyBoxScheduleAt: "",
      });
    } else {
      onApply({
        fullBoxMode: officeMode,
        fullBoxScheduleMode: "pending",
        fullBoxScheduleAt: "",
      });
    }

    onClose();
  }

  function applyFullBoxOfficeReception() {
    onFullBoxReceivedAtOffice?.();
    onClose();
  }

  const driverScheduledActive = scheduleMode === "scheduled" && Boolean(scheduleAt);

  function commitCancelPickup() {
    onApply({
      fullBoxMode: "",
      fullBoxDriverTaskOrdered: false,
      fullBoxScheduleMode: "pending",
      fullBoxScheduleAt: "",
    });
    onClose();
  }

  function commitCancelDelivery() {
    onApply({
      emptyBoxMode: "",
      emptyBoxDriverTaskOrdered: false,
      emptyBoxHandingNow: false,
      emptyBoxScheduleMode: "pending",
      emptyBoxScheduleAt: "",
    });
    onClose();
  }

  function requestCancelPickup() {
    const copy = logisticsLegCancelCopy(FULL_BOX_LEG_LABELS.cancel, FULL_BOX_LEG_LABELS.short);
    setScheduleConfirm({
      ...copy,
      onConfirm: () => {
        setScheduleConfirm(null);
        commitCancelPickup();
      },
    });
  }

  function requestCancelDelivery() {
    const copy = logisticsLegCancelCopy(EMPTY_BOX_LEG_LABELS.cancel, EMPTY_BOX_LEG_LABELS.short);
    setScheduleConfirm({
      ...copy,
      onConfirm: () => {
        setScheduleConfirm(null);
        commitCancelDelivery();
      },
    });
  }

  const isContextMenu = menu.trigger === "context_menu";
  const isLeftClickMenu = menu.trigger === "left_click";

  return (
    <>
      <div
        id="shipment-step-context-menu"
        className="fixed z-50 w-72 overflow-visible rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
        style={{ left: menu.x, top: menu.y }}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => event.stopPropagation()}
      >
      {isStatusMenu || locked || (!isFull && !isEmpty) || (isEmpty && isContextMenu) ? (
        <div className="border-b border-black px-3 py-2">
          <p className="text-xs font-black uppercase text-slate-500">Opciones</p>
          <p className="truncate text-base font-black text-[#f8fafc]">{menu.title}</p>
        </div>
      ) : null}

      {isStatusMenu ? (
        <>
          {currentSummary ? <CurrentOptionBanner label={currentSummary} /> : null}
          <ContextMenuFlyout title="Marcar estado" icon={<MapPinCheck className="h-5 w-5" />}>
            <p className="px-3 pb-2 text-xs font-black uppercase text-slate-500">Marcar estado</p>
            {STATUS_MENU_OPTIONS.map((option) => (
              <FlyoutStatusButton
                key={option.status}
                label={option.label}
                detail={currentStatus === option.status ? "Estado actual" : undefined}
                icon={option.icon}
                onClick={() => {
                  onStatusChange?.(option.status);
                  onClose();
                }}
              />
            ))}
          </ContextMenuFlyout>
          <p className="mt-2 px-2 text-[10px] font-bold text-slate-500">
            Clic izquierdo en la tarjeta aplica el estado de ese paso.
          </p>
        </>
      ) : locked ? (
        <p className="mt-2 rounded-lg border border-black/70 bg-surface-inset px-3 py-2 text-xs font-bold text-slate-400">
          {lockReason}
        </p>
      ) : (
        <>
          {!isFull && !isEmpty && currentSummary ? <CurrentOptionBanner label={currentSummary} /> : null}

          {isFull ? (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={locked || !onFullBoxReceivedAtOffice}
                onClick={applyFullBoxOfficeReception}
                className="flex w-full items-start gap-3 rounded-lg border border-emerald-800/60 bg-emerald-950/20 px-3 py-2.5 text-left hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="mt-0.5 text-emerald-300">
                  <Building2 className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-emerald-100">Cliente entregó caja en oficina</span>
                  <span className="mt-0.5 block text-[11px] font-bold leading-snug text-slate-400">
                    Registra la recepción y cancela la recolección del conductor.
                  </span>
                </span>
              </button>
              <DriverLegReadyMenu
                readyLabel={FULL_BOX_LEG_LABELS.ready}
                cancelLabel={FULL_BOX_LEG_LABELS.cancel}
                scheduleDetail={driverScheduledActive ? scheduleDetail : undefined}
                scheduleChanged={scheduleChanged}
                legOrdered={legOrdered}
                locked={locked}
                onCancel={requestCancelPickup}
                onProgramRoute={
                  onProgramRoute
                    ? () => {
                        onProgramRoute("full_box");
                        onClose();
                      }
                    : undefined
                }
              />
            </div>
          ) : isEmpty ? (
            isContextMenu ? (
              <ContextMenuFlyout
                title="Opciones de dejar"
                icon={<Building2 className="h-5 w-5" />}
                panelClassName="min-w-[14rem]"
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={applyOfficeDelivery}
                  className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-black hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="mt-0.5 text-emerald-300">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#f8fafc]">Entregar en mostrador</span>
                  </span>
                </button>
              </ContextMenuFlyout>
            ) : isLeftClickMenu ? (
              <DriverLegReadyMenu
                readyLabel={EMPTY_BOX_LEG_LABELS.ready}
                cancelLabel={EMPTY_BOX_LEG_LABELS.cancel}
                scheduleDetail={driverScheduledActive ? scheduleDetail : undefined}
                scheduleChanged={scheduleChanged}
                legOrdered={legOrdered}
                locked={locked}
                onCancel={requestCancelDelivery}
                onProgramRoute={
                  onProgramRoute
                    ? () => {
                        onProgramRoute("empty_box");
                        onClose();
                      }
                    : undefined
                }
              />
            ) : null
          ) : null}
        </>
      )}
      </div>

      <ActionConfirmDialog
        open={Boolean(scheduleConfirm)}
        dialogId="shipment-step-schedule-confirm"
        title={scheduleConfirm?.title || ""}
        message={scheduleConfirm?.message || ""}
        confirmLabel={scheduleConfirm?.confirmLabel}
        tone={scheduleConfirm?.tone}
        onCancel={() => setScheduleConfirm(null)}
        onConfirm={() => scheduleConfirm?.onConfirm()}
      />
    </>
  );
}

export function statusForProgressKind(kind: ShipmentProgressKind) {
  if (kind === "office") {
    return "En oficina" as const;
  }

  if (kind === "pickup") {
    return "Pickup" as const;
  }

  if (kind === "transit") {
    return "Enviado" as const;
  }

  if (kind === "delivered") {
    return "Entregado" as const;
  }

  return null;
}

export function isLogisticsLegKind(kind: ShipmentProgressKind) {
  return kind === "empty_box" || kind === "full_box";
}

export function isStatusStepKind(kind: ShipmentProgressKind) {
  return kind === "office" || kind === "pickup" || kind === "transit" || kind === "delivered";
}
