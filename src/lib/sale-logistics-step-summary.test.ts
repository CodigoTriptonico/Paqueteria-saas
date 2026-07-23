import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
  logisticsStepDetailRows,
} from "../components/sale/venta-parts";

describe("sale logistics step summary", () => {
  it("separates pending route details by physical box leg", () => {
    assert.deepEqual(
      logisticsStepDetailRows({
        emptyBoxMode: EMPTY_BOX_DRIVER_MODE,
        emptyBoxScheduleMode: "pending",
        emptyBoxScheduleAt: "",
        emptyBoxRouteSummary: "Ruta pendiente · 25 de julio de 2026",
        fullBoxMode: "",
        fullBoxScheduleMode: "",
        fullBoxScheduleAt: "",
      }),
      [
        {
          label: "Caja vacía",
          value: "Ruta pendiente · 25 de julio de 2026",
        },
        {
          label: "Caja llena",
          value: "Recolección pendiente",
        },
      ],
    );
  });

  it("uses short operational copy for office handoffs", () => {
    assert.deepEqual(
      logisticsStepDetailRows({
        emptyBoxMode: EMPTY_BOX_OFFICE_MODE,
        emptyBoxScheduleMode: "",
        emptyBoxScheduleAt: "",
        fullBoxMode: FULL_BOX_OFFICE_MODE,
        fullBoxScheduleMode: "",
        fullBoxScheduleAt: "",
      }),
      [
        { label: "Caja vacía", value: "Entregada en mostrador" },
        { label: "Caja llena", value: "Cliente entrega en oficina" },
      ],
    );
  });

  it("keeps scheduled driver dates attached to the correct leg", () => {
    const rows = logisticsStepDetailRows({
      emptyBoxMode: EMPTY_BOX_DRIVER_MODE,
      emptyBoxScheduleMode: "scheduled",
      emptyBoxScheduleAt: "2026-07-25T09:30",
      fullBoxMode: FULL_BOX_DRIVER_MODE,
      fullBoxScheduleMode: "scheduled",
      fullBoxScheduleAt: "2026-07-28T14:00",
    });

    assert.match(rows[0]?.value ?? "", /^Entrega · 25.+2026.+9:30/);
    assert.match(rows[1]?.value ?? "", /^Recolección · 28.+2026.+2:00/);
  });
});
