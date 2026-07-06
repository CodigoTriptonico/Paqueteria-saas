"use client";

import type { LogisticsTaskStatus, RouteMemberRow } from "@/app/actions/shipments";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import {
  buildDriverPickerOptions,
  driverLabel,
  formatLogisticsTaskStatusLabel,
} from "@/lib/logistics-view";
import { useMemo } from "react";

type LogisticsTaskStatusBadgeProps = {
  status: LogisticsTaskStatus;
  assignedTo: string | null;
  memberById: ReadonlyMap<string, string>;
  routeMembers: RouteMemberRow[];
  disabled?: boolean;
  shipmentCode: string;
  onDriverChangeRequest: (nextAssignedTo: string | null) => void;
  statusBadgeClass: (status: LogisticsTaskStatus) => string;
};

export function LogisticsTaskStatusBadge({
  status,
  assignedTo,
  memberById,
  routeMembers,
  disabled = false,
  shipmentCode,
  onDriverChangeRequest,
  statusBadgeClass,
}: LogisticsTaskStatusBadgeProps) {
  const showDriverPicker = status === "assigned" || Boolean(assignedTo);
  const driverPickerOptions = useMemo(
    () => buildDriverPickerOptions(routeMembers, "Sin asignar"),
    [routeMembers],
  );

  if (!showDriverPicker) {
    return (
      <span
        className={`rounded-md border px-2 py-1 text-[11px] font-black ${statusBadgeClass(status)}`}
      >
        {formatLogisticsTaskStatusLabel(status, assignedTo, memberById)}
      </span>
    );
  }

  return (
    <InlineSearchPicker
      className="max-w-full"
      minWidthClass="min-w-0 max-w-full"
      shellClassName={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black ${statusBadgeClass("assigned")}`}
      value={assignedTo || ""}
      onChange={(nextValue) => {
        const nextAssignedTo = nextValue || null;
        if (nextAssignedTo !== assignedTo) {
          onDriverChangeRequest(nextAssignedTo);
        }
      }}
      options={driverPickerOptions}
      placeholder="Sin asignar"
      searchPlaceholder="Buscar chofer…"
      emptyLabel="Sin conductores"
      ariaLabel={`Chofer asignado para ${shipmentCode}`}
      disabled={disabled}
      formatSelectedLabel={(option) => {
        const driverName = option?.value
          ? option.label
          : driverLabel(assignedTo, memberById);
        return `Asignado a ${driverName}`;
      }}
    />
  );
}
