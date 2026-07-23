import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function component(path: string) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
}

const envios = component("envios-client.tsx");
const venta = component("venta-client.tsx");
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const uiBlocks = component("ui-blocks.tsx");
const infoDisclosure = component("compact-info-disclosure.tsx");
const platform = component("platform/platform-console.tsx");
const agentsRules = readFileSync(new URL("../../AGENTS.md", import.meta.url), "utf8");
const uiStyle = readFileSync(new URL("../../UI-STYLE.md", import.meta.url), "utf8");

describe("compact page introductions", () => {
  it("removes the persistent shipping and sales-history introductions", () => {
    assert.doesNotMatch(envios, /Operación de envíos|Consulta, seguimiento y trazabilidad en un solo lugar/);
    assert.doesNotMatch(venta, /FlowPageHeader|Ventas, remitentes y destinatarios registrados/);
    assert.doesNotMatch(home, /labelMutedClass|<h3[^>]*>Inicio<\/h3>/);
  });

  it("keeps collapsed mobile actions inside the narrow home surface", () => {
    assert.match(home, /grid min-w-0 grid-cols-\[minmax\(0,1fr\)\] border-t border-black/);
    assert.match(home, /min-h-16 min-w-0 items-center/);
  });

  it("keeps the shipping tabs as the only workspace control", () => {
    assert.match(envios, /workspaceTabs=\{[\s\S]*?<EnviosWorkspaceTabs/);
    assert.match(envios, /function EnviosWorkspaceTabs[\s\S]*?className="flex shrink-0"/);
    assert.match(envios, /role="tablist" aria-label="Vista de envíos"/);
    assert.match(envios, /mb-2 flex w-full items-center gap-2 overflow-x-auto/);
    assert.match(envios, /<span className="sm:hidden">Nuevo<\/span>/);
  });

  it("provides one accessible disclosure pattern for optional explanations", () => {
    assert.match(uiBlocks, /export \{ CompactInfoDisclosure \}/);
    assert.match(infoDisclosure, /aria-label=\{ariaLabel\}/);
    assert.match(infoDisclosure, /aria-expanded=\{open\}/);
    assert.match(infoDisclosure, /event\.key !== "Escape"/);
    assert.match(infoDisclosure, /createPortal/);
    assert.match(infoDisclosure, /resolveFloatingPanelPosition/);
    assert.match(infoDisclosure, /focus-visible:outline/);
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
