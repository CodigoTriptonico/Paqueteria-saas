import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CONFIG_SECTION_LABELS } from "./config-section-labels";

const configSource = readFileSync(
  join(process.cwd(), "src", "components", "configuracion-client.tsx"),
  "utf8",
);
const menuSource = readFileSync(
  join(process.cwd(), "src", "lib", "config-menu-groups.ts"),
  "utf8",
);

describe("config section naming contract", () => {
  it("drives landing cards and panel titles from shared labels", () => {
    assert.match(configSource, /CONFIG_SECTION_LABELS/);
    assert.match(configSource, /CONFIG_SECTION_LABELS\.organization\.title/);
    assert.match(configSource, /CONFIG_SECTION_LABELS\.deliveries\.title/);
    assert.equal(CONFIG_SECTION_LABELS.organization.title, "Organización");
    assert.equal(CONFIG_SECTION_LABELS.deliveries.title, "Entrega y recolección");
  });

  it("describes administration without vague acceso wording", () => {
    assert.match(menuSource, /Organización, asistencia y apariencia/);
    assert.doesNotMatch(menuSource, /Empresa, acceso, equipo/);
    assert.match(menuSource, /Países, precios, proveedores y domicilio/);
  });
});
