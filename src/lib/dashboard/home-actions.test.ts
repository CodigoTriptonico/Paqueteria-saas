import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOME_ACTION_HREFS } from "./home-actions";

describe("home action destinations", () => {
  it("keeps each available home shortcut mapped to its operational route", () => {
    assert.deepEqual(HOME_ACTION_HREFS, {
      newSale: "/venta",
      logistics: "/logistica",
      inventory: "/inventario",
    });
  });

  it("does not expose a separate customer shortcut that reopens Nueva venta", () => {
    assert.equal("customers" in HOME_ACTION_HREFS, false);
    assert.equal(Object.values(HOME_ACTION_HREFS).filter((href) => href === "/venta").length, 1);
  });

  it("keeps Seguimiento and Pickups out of Inicio", () => {
    assert.equal("pickups" in HOME_ACTION_HREFS, false);
    assert.equal("tracking" in HOME_ACTION_HREFS, false);
  });
});
