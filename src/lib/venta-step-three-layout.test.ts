import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src/components/venta-client.tsx"), "utf8");

function sliceAround(marker: string, before = 500) {
  const index = source.indexOf(marker);
  assert.ok(index >= 0, `missing marker: ${marker}`);
  return source.slice(Math.max(0, index - before), index);
}

describe("venta paso 3", () => {
  it("deja la accion debajo del catalogo, igual que el paso 4", () => {
    const catalogIndex = source.indexOf("min-h-0 flex-1 overflow-y-auto pr-1");
    const actionIndex = source.indexOf("onClick={continueFromCart}");

    assert.ok(catalogIndex >= 0, "el catalogo debe tener scroll propio");
    assert.ok(actionIndex >= 0, "debe conservar la accion para continuar");
    assert.ok(catalogIndex < actionIndex, "la accion debe estar despues del catalogo");
    assert.match(
      sliceAround("onClick={continueFromCart}"),
      /flex shrink-0 justify-center border-t border-black\/80 pt-4/,
    );
    assert.match(
      sliceAround("onClick={continueFromLogistics}"),
      /flex shrink-0 justify-center border-t border-black\/80 pt-4/,
    );
  });
});
