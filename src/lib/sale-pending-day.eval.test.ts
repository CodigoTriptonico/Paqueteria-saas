import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const decisionSource = readFileSync(
  new URL("sale-route-decision.ts", import.meta.url),
  "utf8",
);
const panelSource = readFileSync(
  new URL("../components/logistica/logistics-task-schedule-confirm-panel.tsx", import.meta.url),
  "utf8",
);
const saleSource = readFileSync(
  new URL("../components/venta-client.tsx", import.meta.url),
  "utf8",
);

describe("sale unknown day eval", () => {
  it("models unknown day separately from a known day with unknown route", () => {
    assert.match(decisionSource, /kind: "undated";\s*routeDate: null/);
    assert.match(decisionSource, /return "Día y ruta pendientes"/);
  });

  it("keeps the unknown-day choice visible before route planning controls", () => {
    assert.match(saleSource, /allowPendingDay/);
    assert.match(saleSource, /pendingDayLabel="No sé el día"/);
    assert.match(panelSource, /CalendarOff/);
    assert.match(panelSource, /No sé el día deja todo pendiente/);
  });

  it("creates a pending task without a requested route date", () => {
    assert.match(
      decisionSource,
      /status: "pending" as const,\s*scheduledAt: null,\s*requestedRouteDate: decision\.routeDate/,
    );
  });
});
