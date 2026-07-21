import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_OFFICE_MODE,
} from "@/components/sale/venta-parts";
import type { ShipmentLogisticsEditorState } from "@/lib/shipment-logistics-edit";
import {
  EMPTY_BOX_LEG_LABELS,
  FULL_BOX_LEG_LABELS,
} from "@/lib/shipment-leg-labels";
import {
  logisticsLegActiveChannel,
  logisticsLegMenuSummary,
  scheduleApplyButtonLabel,
} from "@/components/shipment-step-context-menu";

const contextMenuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-step-context-menu.tsx"),
  "utf8",
);

const baseState: ShipmentLogisticsEditorState = {
  emptyBoxMode: EMPTY_BOX_OFFICE_MODE,
  emptyBoxHandingNow: false,
  emptyBoxScheduleMode: "pending",
  emptyBoxScheduleAt: "",
  emptyBoxDriverTaskOrdered: false,
  fullBoxMode: "",
  fullBoxScheduleMode: "pending",
  fullBoxScheduleAt: "",
  fullBoxDriverTaskOrdered: false,
};

describe("shipment step context menu", () => {
  it("describes office empty box before and after mostrador handoff", () => {
    assert.equal(
      logisticsLegMenuSummary("empty_box", baseState),
      "Cliente recoge caja vacía en oficina",
    );
    assert.equal(logisticsLegActiveChannel("empty_box", baseState), "office");

    assert.equal(
      logisticsLegMenuSummary("empty_box", { ...baseState, emptyBoxHandingNow: true }),
      "Caja vacia entregada en mostrador",
    );
  });

  it("describes full box pickup separately from empty box delivery", () => {
    assert.equal(logisticsLegMenuSummary("full_box", baseState), "Recolección pendiente");

    const state = {
      ...baseState,
      fullBoxMode: FULL_BOX_OFFICE_MODE,
    };

    assert.equal(
      logisticsLegMenuSummary("full_box", state),
      "Cliente trae caja llena a oficina",
    );
  });

  it("describes driver scheduled empty box", () => {
    const state = {
      ...baseState,
      emptyBoxMode: EMPTY_BOX_DRIVER_MODE,
      emptyBoxScheduleMode: "scheduled",
      emptyBoxScheduleAt: "2026-07-10T10:00:00",
    };

    assert.match(logisticsLegMenuSummary("empty_box", state), /Programar entrega de caja vacia/);
    assert.equal(logisticsLegActiveChannel("empty_box", state), "driver");
  });

  it("keeps schedule apply label helper for legacy callers", () => {
    assert.equal(scheduleApplyButtonLabel(false), "Aplicar programación");
    assert.equal(scheduleApplyButtonLabel(true), "Cambiar fecha");
  });

  it("schedules driver legs only through Programar en ruta", () => {
    assert.match(contextMenuSource, /EMPTY_BOX_LEG_LABELS\.ready/);
    assert.match(contextMenuSource, /FULL_BOX_LEG_LABELS\.ready/);
    assert.match(contextMenuSource, /Programar en ruta/);
    assert.match(contextMenuSource, /function DriverLegReadyMenu/);
    assert.equal(contextMenuSource.includes("DRIVER_LEG_READY_LABELS.setDate"), false);
    assert.equal(contextMenuSource.includes("Establecer una fecha"), false);
    assert.equal(contextMenuSource.includes("onApplySchedule"), false);
    assert.equal(contextMenuSource.includes("scheduleOpen"), false);
    assert.equal(EMPTY_BOX_LEG_LABELS.ready, "Listo para dejar");
    assert.equal(EMPTY_BOX_LEG_LABELS.cancel, "No dejar");
    assert.equal(FULL_BOX_LEG_LABELS.cancel, "No recoger");
    assert.match(contextMenuSource, /title="Opciones de dejar"/);
    assert.match(contextMenuSource, /function requestMarkDriverReady/);
    assert.match(contextMenuSource, /function requestCancelPickup|function requestCancelDelivery/);
    assert.match(contextMenuSource, /logisticsLegCancelCopy/);
    assert.match(contextMenuSource, /ActionConfirmDialog/);
    assert.match(contextMenuSource, /DriverTaskOrdered/);
    assert.match(contextMenuSource, /onProgramRoute/);
  });

  it("keeps the menu open while native pickers are in use", () => {
    assert.match(contextMenuSource, /shouldSuppressDismissForNativePicker/);
    assert.match(
      contextMenuSource,
      /shouldSuppressDismissForNativePicker\(event, menu\)/,
    );
  });
});
