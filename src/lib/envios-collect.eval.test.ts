import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);
const actionsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);
const collectSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-collect.ts"),
  "utf8",
);

describe("envios collect dialog eval", () => {
  it("opens full payment and abono choices from Cobrar", () => {
    assert.equal(enviosSource.includes("ShipmentCollectDialog"), true);
    assert.equal(enviosSource.includes('setFinalizeCollectMode("choose")'), true);
    assert.equal(collectSource.includes("Pago completo"), true);
    assert.equal(collectSource.includes("Abono"), true);
  });

  it("supports partial collection on the server", () => {
    assert.equal(actionsSource.includes("amount?: string"), true);
    assert.equal(actionsSource.includes("sale.invoice_partial_payment"), true);
    assert.equal(enviosSource.includes("resolveShipmentCollectAmount"), true);
  });

  it("keeps full-payment option detail readable on the emerald primary button", () => {
    const dialogSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-collect-dialog.tsx"),
      "utf8",
    );
    assert.equal(dialogSource.includes("text-slate-950/70"), true);
    assert.equal(dialogSource.includes("text-emerald-100/80"), false);
  });
});
