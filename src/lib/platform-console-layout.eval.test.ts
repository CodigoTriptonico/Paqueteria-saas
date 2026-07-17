import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/platform/platform-console.tsx"),
  "utf8",
);

describe("platform companies layout eval", () => {
  it("puts the company summary above the left-aligned filters", () => {
    const statsPosition = source.indexOf("platformStats.total");
    const filtersPosition = source.indexOf("FILTER_OPTIONS.map");
    const searchPosition = source.indexOf('placeholder="Buscar empresa"');

    assert.ok(statsPosition > 0 && statsPosition < filtersPosition);
    assert.ok(filtersPosition > 0 && filtersPosition < searchPosition);
  });

  it("groups company actions in a right-click context menu", () => {
    assert.match(source, /onContextMenu=\{\(event\) => openContextMenu\(event, org\.id\)\}/);
    assert.match(source, /data-platform-company-context-menu/);
    assert.match(source, /role="menu"/);
    assert.match(source, /Clic derecho para opciones/);
    assert.match(source, /Cerrar y archivar/);
  });
});
