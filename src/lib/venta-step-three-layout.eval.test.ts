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

describe("venta paso 3 layout eval", () => {
  it("deja Siguiente abajo y fuera del scroll de productos, alineado con el paso 4", () => {
    const scrollIndex = source.indexOf("min-h-0 flex-1 overflow-y-auto pr-1");
    const buttonIndex = source.indexOf("onClick={continueFromCart}");

    assert.ok(scrollIndex >= 0, "el catalogo debe tener scroll propio");
    assert.ok(buttonIndex >= 0, "debe conservar la accion para continuar");
    assert.ok(buttonIndex > scrollIndex, "Siguiente debe estar despues del catalogo en el DOM");
    assert.equal(source.includes("sticky top-0 z-20"), false);
    assert.equal(source.includes("order-first flex shrink-0"), false);
    assert.equal(source.includes("order-last min-h-0 flex-1 overflow-y-auto"), false);
    assert.match(
      sliceAround("onClick={continueFromCart}"),
      /flex shrink-0 justify-center border-t border-black\/80 pt-4/,
    );
    assert.match(
      sliceAround("onClick={continueFromLogistics}"),
      /flex shrink-0 justify-center border-t border-black\/80 pt-4/,
    );
    assert.match(
      source,
      /activeStep === "box" \|\|\s*activeStep === "delivery"\s*\? "flex min-h-0 flex-1 flex-col lg:overflow-hidden"/,
    );
  });
});
