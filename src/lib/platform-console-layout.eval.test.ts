import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/platform/platform-console.tsx"),
  "utf8",
);

describe("platform companies layout eval", () => {
  it("uses the company status summary itself as the filter control", () => {
    const statsPosition = source.indexOf("platformStats.total");
    const filtersPosition = source.indexOf("FILTER_OPTIONS.map");
    const searchPosition = source.indexOf('placeholder="Buscar empresa"');

    assert.ok(statsPosition > 0 && statsPosition < searchPosition);
    assert.ok(filtersPosition > 0 && filtersPosition < searchPosition);
    assert.match(source, /aria-pressed=\{selected\}/);
    assert.doesNotMatch(source, /Clic derecho para opciones/);
    assert.match(source, /max-w-xl/);
  });

  it("opens company detail as its own view and retains the right-click menu", () => {
    assert.match(source, /onContextMenu=\{\(event\) => openContextMenu\(event, org\.id\)\}/);
    assert.match(source, /data-platform-company-context-menu/);
    assert.match(source, /role="menu"/);
    assert.match(source, /className=\{selectedOrg \? "hidden" : undefined\}/);
    assert.match(source, /min-h-\[calc\(100dvh-7rem\)\]/);
    assert.match(source, /Detalle de empresa/);
    assert.match(source, /<ArrowLeft className="h-4 w-4" \/>/);
    assert.match(source, /Cerrar y archivar/);
  });
});
