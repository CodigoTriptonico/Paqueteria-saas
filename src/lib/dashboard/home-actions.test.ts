import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOME_ACTION_HREFS } from "./home-actions";

describe("home action destinations", () => {
  it("keeps each available home shortcut mapped to its operational route", () => {
    assert.deepEqual(HOME_ACTION_HREFS, {
      newSale: "/venta",
      pickups: "/logistica",
      tracking: "/seguimiento",
    });
  });

  it("does not expose a separate customer shortcut that reopens Nueva venta", () => {
    assert.equal("customers" in HOME_ACTION_HREFS, false);
    assert.equal(Object.values(HOME_ACTION_HREFS).filter((href) => href === "/venta").length, 1);
  });
});
