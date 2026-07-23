import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function component(path: string) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
}

const envios = component("envios-client.tsx");
const venta = component("venta-client.tsx");
const uiBlocks = component("ui-blocks.tsx");
const platform = component("platform/platform-console.tsx");
const agentsRules = readFileSync(new URL("../../AGENTS.md", import.meta.url), "utf8");
const uiStyle = readFileSync(new URL("../../UI-STYLE.md", import.meta.url), "utf8");

describe("compact page introductions", () => {
  it("removes the persistent shipping and sales-history introductions", () => {
    assert.doesNotMatch(envios, /Operación de envíos|Consulta, seguimiento y trazabilidad en un solo lugar/);
    assert.doesNotMatch(venta, /FlowPageHeader|Ventas, remitentes y destinatarios registrados/);
  });

  it("keeps the shipping tabs as the only workspace control", () => {
    assert.match(envios, /workspaceTabs=\{[\s\S]*?<EnviosWorkspaceTabs/);
    assert.match(envios, /function EnviosWorkspaceTabs[\s\S]*?className="flex shrink-0"/);
    assert.match(envios, /role="tablist" aria-label="Vista de envíos"/);
    assert.match(envios, /mb-2 flex w-full items-center gap-2 overflow-x-auto/);
    assert.match(envios, /<span className="sm:hidden">Nuevo<\/span>/);
  });

  it("provides one accessible disclosure pattern for optional explanations", () => {
    assert.match(uiBlocks, /export function CompactInfoDisclosure/);
    assert.match(uiBlocks, /<details className="group relative shrink-0">/);
    assert.match(uiBlocks, /<summary[\s\S]*aria-label=\{ariaLabel\}/);
    assert.match(uiBlocks, /focus-visible:outline/);
  });

  it("integrates platform creation into the existing filter toolbar", () => {
    assert.doesNotMatch(platform, /Administración de plataforma/);
    assert.match(platform, /aria-label="Filtrar empresas por estado"[\s\S]*Nueva empresa/);
    assert.match(platform, /Información de empresas/);
  });

  it("keeps the no-intro-header rule in the project documentation", () => {
    assert.match(agentsRules, /No crear encabezados introductorios permanentes de página/);
    assert.match(agentsRules, /CompactInfoDisclosure/);
    assert.match(uiStyle, /Regla estricta: sin encabezados introductorios/);
    assert.match(uiStyle, /No reservar una franja solo para texto/);
  });
});
