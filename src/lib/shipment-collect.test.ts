import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveShipmentCollectAmount,
  shipmentCollectCopy,
  shipmentCollectSuccessMessage,
} from "@/lib/shipment-collect";

describe("resolveShipmentCollectAmount", () => {
  it("defaults to the full balance when amount is omitted", () => {
    const result = resolveShipmentCollectAmount(undefined, 15);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.amount, 15);
      assert.equal(result.isFullPayment, true);
    }
  });

  it("accepts a partial amount below the balance", () => {
    const result = resolveShipmentCollectAmount("$10", 15);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.amount, 10);
      assert.equal(result.isFullPayment, false);
    }
  });

  it("rejects amounts above the pending balance", () => {
    const result = resolveShipmentCollectAmount("$20", 15);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /superar/);
    }
  });
});

describe("shipmentCollectCopy", () => {
  it("offers full payment and abono on the first step", () => {
    const copy = shipmentCollectCopy(15, "choose");

    assert.equal(copy.title, "¿Cómo quieres cobrar?");
    assert.equal(copy.fullOptionLabel, "Pago completo");
    assert.equal(copy.partialOptionLabel, "Abono");
  });

  it("labels partial collection clearly", () => {
    const copy = shipmentCollectCopy(15, "partial");

    assert.equal(copy.title, "Registrar abono");
    assert.equal(copy.confirmLabel, "Registrar abono");
  });
});

describe("shipmentCollectSuccessMessage", () => {
  it("distinguishes full payment from partial abono", () => {
    assert.equal(shipmentCollectSuccessMessage("INV-000002", 15, true), "Invoice INV-000002 cobrado");
    assert.equal(
      shipmentCollectSuccessMessage("INV-000002", 10, false),
      "Abono de $10 registrado en INV-000002",
    );
  });
});

describe("invoice collection atomicity eval", () => {
  it("uses one database function for shipment update and payment insert", () => {
    const actionsSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
      "utf8",
    );
    const migrationSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations/042_atomic_invoice_collection.sql"),
      "utf8",
    );

    assert.match(actionsSource, /collect_shipment_invoice_payment/);
    assert.match(migrationSource, /update public\.shipments[\s\S]*insert into public\.shipment_payments/);
  });
});
