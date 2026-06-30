"use client";

import { Building2, CalendarDays, MapPinCheck, Plane, Store, Truck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ShipmentStatus } from "@/app/actions/shipments";
import { ScheduleTimeField } from "@/components/sale/schedule-time-field";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
  minScheduleDateInput,
  resolveScheduleDate,
} from "@/components/sale/venta-parts";
import type { ShipmentProgressKind } from "@/lib/shipment-display";
import type { ShipmentLogisticsEditorState } from "@/lib/shipment-logistics-edit";

export type ShipmentStepMenuState = {
  kind: ShipmentProgressKind;
  title: string;
  x: number;
  y: number;
} | null;

type MenuAction = {
  label: string;
  detail?: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type ShipmentStepContextMenuProps = {
  menu: ShipmentStepMenuState;
  lockReason?: string;
  scheduleMode: string;
  scheduleAt: string;
  currentStatus?: ShipmentStatus;
  onClose: () => void;
  onApply: (patch: Partial<ShipmentLogisticsEditorState>) => void;
  onStatusChange?: (status: ShipmentStatus) => void;
};

const STATUS_MENU_OPTIONS: Array<{ status: ShipmentStatus; label: string; icon: ReactNode }> = [
  { status: "Pendiente", label: "Pendiente", icon: <MapPinCheck className="h-4 w-4" /> },
  { status: "En oficina", label: "En oficina", icon: <Building2 className="h-4 w-4" /> },
  { status: "Pickup", label: "Salida", icon: <Truck className="h-4 w-4" /> },
  { status: "Enviado", label: "En tránsito", icon: <Plane className="h-4 w-4" /> },
  { status: "Entregado", label: "Entregado", icon: <MapPinCheck className="h-4 w-4" /> },
];

function MenuButton({ action }: { action: MenuAction }) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={action.onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-black hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="mt-0.5 text-emerald-300">{action.icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#f8fafc]">{action.label}</span>
        {action.detail ? (
          <span className="mt-0.5 block text-xs font-bold text-slate-400">{action.detail}</span>
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
  currentStatus,
  onClose,
  onApply,
  onStatusChange,
}: ShipmentStepContextMenuProps) {
  const [routeDate, setRouteDate] = useState("");
  const [routeTime, setRouteTime] = useState("10:00");

  useEffect(() => {
    if (!menu) {
      return;
    }

    queueMicrotask(() => {
      const [date = "", time = "10:00"] = scheduleAt.split("T");
      setRouteDate(date);
      setRouteTime(time || "10:00");
    });
  }, [menu, scheduleAt]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    function closeOnPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (document.getElementById("shipment-step-context-menu")?.contains(target)) {
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
  const legKey = isEmpty ? "emptyBox" : "fullBox";
  const officeMode = isEmpty ? EMPTY_BOX_OFFICE_MODE : FULL_BOX_OFFICE_MODE;
  const driverMode = isEmpty ? EMPTY_BOX_DRIVER_MODE : FULL_BOX_DRIVER_MODE;

  function applyDriverScheduled() {
    const resolvedDate = resolveScheduleDate(routeDate);
    const resolvedTime = routeTime || "10:00";

    onApply({
      [`${legKey}Mode`]: driverMode,
      [`${legKey}ScheduleMode`]: "scheduled",
      [`${legKey}ScheduleAt`]: `${resolvedDate}T${resolvedTime}`,
      ...(isEmpty ? { emptyBoxHandingNow: false } : {}),
    } as Partial<ShipmentLogisticsEditorState>);
    onClose();
  }

  const actions: MenuAction[] = [];

  if (isEmpty || isFull) {
    actions.push(
      {
        label: "En oficina",
        detail: isEmpty ? "Cliente recoge después" : "Cliente la trae",
        icon: <Building2 className="h-4 w-4" />,
        disabled: locked,
        onClick: () => {
          onApply(
            isEmpty
              ? {
                  emptyBoxMode: officeMode,
                  emptyBoxHandingNow: false,
                  emptyBoxScheduleMode: "pending",
                  emptyBoxScheduleAt: "",
                }
              : {
                  fullBoxMode: officeMode,
                  fullBoxScheduleMode: "pending",
                  fullBoxScheduleAt: "",
                },
          );
          onClose();
        },
      },
      ...(isEmpty
        ? [
            {
              label: "Mostrador",
              detail: "Entregar ahora en mostrador",
              icon: <Store className="h-4 w-4" />,
              disabled: locked,
              onClick: () => {
                onApply({
                  emptyBoxMode: officeMode,
                  emptyBoxHandingNow: true,
                  emptyBoxScheduleMode: "pending",
                  emptyBoxScheduleAt: "",
                });
                onClose();
              },
            } satisfies MenuAction,
          ]
        : []),
      {
        label: "A domicilio",
        detail: "Chofer — sin fecha aún",
        icon: <Truck className="h-4 w-4" />,
        disabled: locked,
        onClick: () => {
          onApply({
            [`${legKey}Mode`]: driverMode,
            [`${legKey}ScheduleMode`]: "pending",
            [`${legKey}ScheduleAt`]: "",
            ...(isEmpty ? { emptyBoxHandingNow: false } : {}),
          } as Partial<ShipmentLogisticsEditorState>);
          onClose();
        },
      },
    );
  }

  return (
    <div
      id="shipment-step-context-menu"
      className="fixed z-50 w-72 overflow-visible rounded-xl border border-black bg-surface-panel p-2 shadow-2xl"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="border-b border-black px-3 py-2">
        <p className="text-xs font-black uppercase text-slate-500">Opciones</p>
        <p className="truncate text-base font-black text-[#f8fafc]">{menu.title}</p>
      </div>

      {isStatusMenu ? (
        <div className="mt-1 grid gap-0.5">
          <p className="px-3 py-1 text-[10px] font-black uppercase text-slate-500">Marcar estado</p>
          {STATUS_MENU_OPTIONS.map((option) => (
            <MenuButton
              key={option.status}
              action={{
                label: option.label,
                detail: currentStatus === option.status ? "Estado actual" : undefined,
                icon: option.icon,
                onClick: () => {
                  onStatusChange?.(option.status);
                  onClose();
                },
              }}
            />
          ))}
          <p className="mt-2 px-2 text-[10px] font-bold text-slate-500">
            Clic izquierdo en la tarjeta aplica el estado de ese paso.
          </p>
        </div>
      ) : locked ? (
        <p className="mt-2 rounded-lg border border-black/70 bg-surface-inset px-3 py-2 text-xs font-bold text-slate-400">
          {lockReason}
        </p>
      ) : (
        <div className="mt-1 grid gap-0.5">
          {actions.map((action) => (
            <MenuButton key={action.label} action={action} />
          ))}

          {isEmpty || isFull ? (
            <div className="mt-2 rounded-lg border border-black/70 bg-[#2e3834] p-3">
              <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                Programar chofer
              </p>
              <div className="grid gap-2">
                <input
                  type="date"
                  min={minScheduleDateInput()}
                  value={routeDate}
                  onChange={(event) => setRouteDate(event.target.value)}
                  className="h-9 rounded-lg border border-black bg-[#111827] px-3 text-sm font-bold text-[#f8fafc]"
                />
                <ScheduleTimeField
                  value={routeTime}
                  onChange={(timePart) => setRouteTime(timePart)}
                />
                <button
                  type="button"
                  onClick={applyDriverScheduled}
                  className="h-9 rounded-lg border border-emerald-700/50 bg-emerald-950/40 text-xs font-black text-emerald-200 hover:bg-emerald-900/50"
                >
                  Aplicar fecha de chofer
                </button>
                {scheduleMode === "scheduled" && scheduleAt ? (
                  <p className="text-[11px] font-bold text-slate-500">Actual: programado</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-2 px-2 text-[10px] font-bold text-slate-500">
            Clic izquierdo en la tarjeta alterna oficina / domicilio.
          </p>
        </div>
      )}
    </div>
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
