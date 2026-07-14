import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const auditoriaClientSource = readFileSync(
  join(root, "components/auditoria-client.tsx"),
  "utf8",
);

const estadisticasSource = readFileSync(
  join(root, "components/estadisticas-client.tsx"),
  "utf8",
);

const enviosSource = readFileSync(join(root, "components/envios-client.tsx"), "utf8");

const auditSource = readFileSync(join(root, "lib/shipment-audit.ts"), "utf8");

describe("auditoria route eval", () => {
  it("registers dedicated auditoria page with shipment deep link", () => {
    assert.match(auditoriaClientSource, /EstadisticasAuditoriaPanel/);
    assert.match(auditoriaClientSource, /searchParams\.get\("shipment"\)/);
    assert.equal(estadisticasSource.includes('id: "auditoria"'), false);
    assert.equal(estadisticasSource.includes('id: "inventario"'), false);
    assert.match(estadisticasSource, /router\.replace\(shipment \? `\/auditoria\?shipment=\$\{shipment\}` : "\/auditoria"\)/);
    assert.match(estadisticasSource, /router\.replace\("\/inventario"\)/);
  });
});

describe("auditoria panel eval", () => {
  it("passes activity rows into AuditHistoryLine", () => {
    const panelSource = readFileSync(
      join(root, "components/estadisticas/auditoria-panel.tsx"),
      "utf8",
    );
    assert.equal(panelSource.includes("<AuditHistoryEntry entry={entry} />"), true);
    assert.equal(panelSource.includes("timestamp={stepHistoryTimestamp"), false);
    assert.equal(panelSource.includes("detail={entry.description}"), false);
    assert.equal(panelSource.includes("sale.invoice_priority_updated"), false);
  });
});

describe("envios auditoria menu eval", () => {
  it("opens dedicated auditoria route from shipment context menu", () => {
    assert.match(enviosSource, /EnviosShipmentContextMenu/);
    assert.match(enviosSource, /handleShipmentContextMenu/);
    assert.match(enviosSource, /\/auditoria\?shipment=/);
    assert.equal(enviosSource.includes("ShipmentAuditPanel"), false);
  });
});

describe("logistics task ordered audit eval", () => {
  it("labels ordered logistics tasks in audit history", () => {
    assert.match(auditSource, /shipment\.logistics_task_ordered/);
    assert.match(auditSource, /describeLogisticsTaskOrdered/);
  });
});
