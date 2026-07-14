import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src/components/venta-client.tsx"), "utf8");

describe("venta paso 3", () => {
  it("deja la accion antes del catalogo desplazable", () => {
    const actionIndex = source.indexOf("onClick={continueFromCart}");
    const catalogIndex = source.indexOf("min-h-0 flex-1 overflow-y-auto pt-3 pr-1");

    assert.ok(actionIndex >= 0, "debe conservar la accion para continuar");
    assert.ok(catalogIndex > actionIndex, "el catalogo debe estar despues de la accion");
  });
});
