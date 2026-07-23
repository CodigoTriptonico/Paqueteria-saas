import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function component(path: string) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), "utf8");
}

const sources = {
  agencyClose: component("agency-daily-close-client.tsx"),
  agencyPrices: component("business/agency-public-price-panel.tsx"),
  business: component("business/business-command-center.tsx"),
  commercial: component("commercial/commercial-admin-client.tsx"),
  custody: component("controlled-operations-client.tsx"),
  platform: component("platform/platform-console.tsx"),
  warehouse: component("warehouse/warehouse-client.tsx"),
};

describe("compact page introductions eval", () => {
  it("removes static title cards from operational workspaces", () => {
    for (const [name, source] of Object.entries(sources)) {
      assert.doesNotMatch(
        source,
        /<header className="rounded-xl border border-black bg-surface-(?:shell|card) p/,
        `${name} still has a persistent page-introduction card`,
      );
    }
  });

  it("moves useful explanations behind explicit info controls", () => {
    assert.match(sources.custody, /CompactInfoDisclosure ariaLabel="Cómo funciona la custodia"/);
    assert.match(sources.business, /CompactInfoDisclosure ariaLabel="Información de esta vista"/);
    assert.match(sources.agencyClose, /CompactInfoDisclosure ariaLabel="Información del cierre diario"/);
    assert.match(sources.agencyPrices, /CompactInfoDisclosure ariaLabel=\{`Información de precios de \$\{data\.agencyName\}`\}/);
    assert.match(sources.commercial, /CompactInfoDisclosure ariaLabel="Información de administración comercial"/);
    assert.match(sources.platform, /CompactInfoDisclosure ariaLabel="Información de empresas"/);
  });

  it("retains only identity and status when a selected record needs context", () => {
    assert.match(sources.commercial, /min-h-11 items-center[\s\S]*\{entity\.name\}[\s\S]*\{entity\.status\}/);
    assert.match(sources.platform, /min-h-11 items-center[\s\S]*\{selectedOrg\.name\}[\s\S]*StatusPill/);
  });

  it("merges warehouse actions into one operational strip", () => {
    assert.doesNotMatch(sources.warehouse, /<h1[^>]*>Bodega<\/h1>/);
    assert.match(sources.warehouse, /Camiones y recepción física[\s\S]*Ingreso[\s\S]*Descargar camión/);
  });
});
