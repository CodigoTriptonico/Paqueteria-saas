import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inventarioHrefWithReturn,
  inventarioReturnActionLabel,
  isAllowedInventarioReturnTo,
  readInventarioReturnTo,
} from "./inventario-return";

describe("inventario return navigation", () => {
  it("builds inventario href with encoded return path", () => {
    const href = inventarioHrefWithReturn(
      "/configuracion?view=prices&country=M%C3%A9xico",
    );

    assert.equal(
      href,
      "/inventario?returnTo=%2Fconfiguracion%3Fview%3Dprices%26country%3DM%25C3%25A9xico",
    );
  });

  it("rejects external return targets", () => {
    assert.equal(isAllowedInventarioReturnTo("//evil.test/phish"), false);
    assert.equal(isAllowedInventarioReturnTo("https://evil.test"), false);
    assert.equal(inventarioHrefWithReturn("https://evil.test"), "/inventario");
  });

  it("reads return path from search params", () => {
    const params = new URLSearchParams(
      "returnTo=%2Fconfiguracion%3Fview%3Dprices%26country%3DMexico",
    );

    assert.equal(
      readInventarioReturnTo(params),
      "/configuracion?view=prices&country=Mexico",
    );
  });

  it("labels country pricing return actions", () => {
    assert.equal(
      inventarioReturnActionLabel("/configuracion?view=prices&country=México"),
      "Volver a precios de México",
    );
    assert.equal(
      inventarioReturnActionLabel("/configuracion?view=prices"),
      "Volver a Países y precios",
    );
    assert.equal(inventarioReturnActionLabel("/venta"), "Volver a Nueva venta");
  });
});
