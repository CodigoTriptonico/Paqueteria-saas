import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const panelSource = readFileSync(
  new URL("../components/logistica/logistics-task-schedule-confirm-panel.tsx", import.meta.url),
  "utf8",
);
const saleSource = readFileSync(
  new URL("../components/venta-client.tsx", import.meta.url),
  "utf8",
);

describe("sale pending day", () => {
  it("offers one explicit action before the day, date and route controls", () => {
    const pendingDayIndex = panelSource.indexOf("{pendingDayLabel}");
    const dateFieldsIndex = panelSource.indexOf("{routeFirst ? (", pendingDayIndex);

    assert.ok(pendingDayIndex >= 0);
    assert.ok(dateFieldsIndex > pendingDayIndex);
    assert.match(panelSource, /onClick=\{\(\) => void onConfirmPendingDay\(\)\}/);
    assert.match(panelSource, /Deja día, fecha, ruta y conductor pendientes\./);
  });

  it("clears date and route state for every sale delivery leg", () => {
    assert.match(
      saleSource,
      /const decision: SaleRouteDecision = \{ kind: "undated", routeDate: null \}/,
    );
    assert.match(
      saleSource,
      /setEmptyBoxScheduleMode\("pending"\);\s*setEmptyBoxScheduleAt\(""\);\s*setEmptyBoxRouteDecision\(decision\)/,
    );
    assert.match(
      saleSource,
      /setFullBoxScheduleMode\("pending"\);\s*setFullBoxScheduleAt\(""\);\s*setFullBoxRouteDecision\(decision\)/,
    );
    assert.match(saleSource, /onConfirmPendingDay=\{confirmSalePendingDay\}/);
  });
});
