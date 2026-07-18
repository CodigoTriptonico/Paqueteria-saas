import assert from "node:assert/strict";
import test from "node:test";
import { custodyCurrentLabel, packageCustodyEventLabel } from "./package-custody";

test("custody labels describe every automatic and manual handoff", () => {
  assert.equal(packageCustodyEventLabel.collected, "Recogida y cargada con conductor");
  assert.equal(packageCustodyEventLabel.palletized, "Asignada a paleta");
  assert.equal(packageCustodyEventLabel.manual_handoff, "Traspaso recibido");
});

test("custody never renders an empty current holder", () => {
  assert.equal(custodyCurrentLabel("  "), "Custodia sin identificar");
  assert.equal(custodyCurrentLabel("Bodega"), "Bodega");
});
