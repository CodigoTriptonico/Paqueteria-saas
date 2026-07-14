import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src/components/venta-client.tsx"), "utf8");

describe("venta paso 3 layout eval", () => {
  it("deja Siguiente arriba y fuera del scroll de productos", () => {
    const buttonIndex = source.indexOf("onClick={continueFromCart}");
    const scrollIndex = source.indexOf("min-h-0 flex-1 overflow-y-auto pt-3 pr-1");

    assert.ok(scrollIndex >= 0, "el catalogo debe tener scroll propio");
    assert.ok(buttonIndex >= 0, "debe conservar la accion para continuar");
    assert.ok(buttonIndex < scrollIndex, "Siguiente debe estar antes del catalogo en el DOM");
    assert.equal(source.includes("order-first flex shrink-0"), false);
    assert.equal(source.includes("order-last min-h-0 flex-1 overflow-y-auto"), false);
    assert.match(source, /activeStep === "box"\s*\? "flex min-h-0 flex-1 flex-col lg:overflow-hidden"/);
  });
});
