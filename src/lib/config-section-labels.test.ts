import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG_SECTION_LABELS } from "./config-section-labels";

describe("config section labels", () => {
  it("names each section by what it actually configures", () => {
    assert.equal(CONFIG_SECTION_LABELS.organization.title, "Organización");
    assert.match(CONFIG_SECTION_LABELS.organization.text, /bodegas/i);
    assert.match(CONFIG_SECTION_LABELS.organization.text, /importación/i);
    assert.equal(CONFIG_SECTION_LABELS.prices.title, "Países y precios");
    assert.equal(CONFIG_SECTION_LABELS.distributors.title, "Distribuidores");
    assert.equal(CONFIG_SECTION_LABELS.deliveries.title, "Entrega y recolección");
    assert.doesNotMatch(CONFIG_SECTION_LABELS.deliveries.title, /Logística/);
    assert.equal(CONFIG_SECTION_LABELS.appearance.title, "Apariencia");
    assert.equal(CONFIG_SECTION_LABELS.timeclock.title, "Control de horario");
  });

  it("keeps delivery settings distinct from the logistics operations module", () => {
    assert.match(CONFIG_SECTION_LABELS.deliveries.text, /domicilio|horarios|Depósito/i);
    assert.doesNotMatch(CONFIG_SECTION_LABELS.deliveries.text, /rutas|conductores/i);
  });
});
