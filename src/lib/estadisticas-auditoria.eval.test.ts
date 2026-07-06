import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const estadisticasSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/estadisticas-client.tsx"),
  "utf8",
);

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);

const auditSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../lib/shipment-audit.ts"),
  "utf8",
);

describe("estadisticas auditoria eval", () => {
  it("registers auditoria section and shipment deep link", () => {
    assert.match(estadisticasSource, /id: "auditoria"/);
    assert.match(estadisticasSource, /EstadisticasAuditoriaPanel/);
    assert.match(estadisticasSource, /searchParams\.get\("shipment"\)/);
  });
});

describe("estadisticas auditoria panel eval", () => {
  it("passes activity rows into AuditHistoryLine", () => {
    const panelSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/estadisticas/auditoria-panel.tsx"),
      "utf8",
    );
    assert.equal(panelSource.includes("<AuditHistoryEntry entry={entry} />"), true);
    assert.equal(panelSource.includes("timestamp={stepHistoryTimestamp"), false);
    assert.equal(panelSource.includes("detail={entry.description}"), false);
    assert.equal(panelSource.includes("sale.invoice_priority_updated"), false);
  });
});

describe("envios auditoria menu eval", () => {
  it("opens estadisticas auditoria from shipment context menu", () => {
    assert.match(enviosSource, /EnviosShipmentContextMenu/);
    assert.match(enviosSource, /handleShipmentContextMenu/);
    assert.match(enviosSource, /\/estadisticas\?view=auditoria&shipment=/);
    assert.equal(enviosSource.includes("ShipmentAuditPanel"), false);
  });
});

describe("logistics task ordered audit eval", () => {
  it("labels ordered logistics tasks in audit history", () => {
    assert.match(auditSource, /shipment\.logistics_task_ordered/);
    assert.match(auditSource, /describeLogisticsTaskOrdered/);
  });
});
