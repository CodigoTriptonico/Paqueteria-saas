import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAppNavActiveLabel } from "./app-navigation";

describe("resolveAppNavActiveLabel", () => {
  it("marks every warehouse workflow route with its exact sidebar label", () => {
    assert.equal(resolveAppNavActiveLabel("/ingreso-bodega"), "Ingreso a bodega");
    assert.equal(resolveAppNavActiveLabel("/ingreso-bodega/sesion/abc"), "Ingreso a bodega");
    assert.equal(resolveAppNavActiveLabel("/bodega"), "Bodega");
    assert.equal(resolveAppNavActiveLabel("/paletas/nueva"), "Paletas");
  });

  it("uses the same label rendered by the agencies sidebar item", () => {
    assert.equal(resolveAppNavActiveLabel("/agencias"), "Vendedores y agencias");
  });

  it("keeps aliases and unknown routes deterministic", () => {
    assert.equal(resolveAppNavActiveLabel("/envios?view=history"), "Seguimiento y envíos");
    assert.equal(resolveAppNavActiveLabel("/ruta-desconocida"), "Inicio");
  });
});
