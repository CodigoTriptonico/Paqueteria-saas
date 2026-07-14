import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enviosSource = readFileSync(join(root, "components/envios-client.tsx"), "utf8");
const displaySource = readFileSync(join(root, "lib/shipment-display.ts"), "utf8");
const historialPageSource = readFileSync(
  join(root, "app/seguimiento/historial/page.tsx"),
  "utf8",
);
const trackingPageSource = readFileSync(join(root, "app/seguimiento/page.tsx"), "utf8");

describe("envios tracking vs history eval", () => {
  it("wires mode prop and partition helper in EnviosClient", () => {
    assert.match(enviosSource, /mode\?: EnviosClientMode/);
    assert.match(enviosSource, /filterShipmentsForEnviosMode\(shipments, mode\)/);
    assert.match(trackingPageSource, /mode="tracking"/);
    assert.match(historialPageSource, /mode="history"/);
  });

  it("uses distinct panel titles for tracking and history", () => {
    assert.match(enviosSource, /Historial de envíos/);
    assert.match(enviosSource, /Seguimiento/);
  });

  it("hides tracking-only status filter in history mode", () => {
    assert.match(enviosSource, /!isHistoryMode \? \(/);
    assert.doesNotMatch(displaySource, /label: "Ya en destino final"/);
  });

  it("disables route operational actions in history while keeping audit and collect", () => {
    assert.match(enviosSource, /canEditStatus=\{!isHistoryMode && canUpdateShipmentStatus\}/);
    assert.match(enviosSource, /canEditLogistics=\{!isHistoryMode && canManageSales\}/);
    assert.match(enviosSource, /canManageSales && !isHistoryMode \? \(/);
    assert.match(enviosSource, /EnviosShipmentContextMenu/);
    assert.match(enviosSource, /ShipmentCollectDialog/);
  });

  it("keeps progress editing enabled in tracking mode", () => {
    assert.match(enviosSource, /canEditStatus=\{!isHistoryMode && canUpdateShipmentStatus\}/);
    assert.match(enviosSource, /canEdit=\{canEditProgress\}/);
    assert.match(enviosSource, /const canEditProgress = !isHistoryMode/);
  });

  it("shows entregados counter in history toolbar", () => {
    assert.match(enviosSource, /isHistoryMode \? "entregados" : "total"/);
    assert.match(enviosSource, /Sin envíos entregados/);
  });
});

describe("envios broad search eval", () => {
  it("uses the shared broad search helper for tracking and history", () => {
    assert.match(enviosSource, /matchesEnviosSearchQuery\(row, query\)/);
    assert.match(displaySource, /export function matchesEnviosSearchQuery/);
    assert.match(displaySource, /row\.customerSearchText/);
    assert.match(displaySource, /primitiveSearchValues\(row\.recipientSnapshot\)/);
    assert.match(enviosSource, /Nombre, tel[ée]fono, CP, invoice/);
  });
});
