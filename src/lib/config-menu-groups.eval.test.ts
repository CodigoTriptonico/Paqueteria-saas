import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG_MENU_GROUPS } from "./config-menu-groups";

describe("config menu groups eval", () => {
  it("uses Spanish group titles that match the product vocabulary", () => {
    const titles = CONFIG_MENU_GROUPS.map((group) => group.title);
    assert.deepEqual(titles, ["Operación", "Administración"]);
  });

  it("describes groups by the work they cover", () => {
    const operation = CONFIG_MENU_GROUPS.find((group) => group.id === "operation");
    const administration = CONFIG_MENU_GROUPS.find((group) => group.id === "administration");
    assert.match(operation?.description || "", /domicilio/);
    assert.match(administration?.description || "", /Organización/);
    assert.doesNotMatch(operation?.description || "", /logística/i);
  });

  it("keeps daily workflow settings separate from account settings", () => {
    const operation = CONFIG_MENU_GROUPS.find((group) => group.id === "operation");
    const administration = CONFIG_MENU_GROUPS.find((group) => group.id === "administration");

    for (const sectionId of ["prices", "distributors", "deliveries"] as const) {
      assert.ok(operation?.sectionIds.includes(sectionId));
    }
    for (const sectionId of ["organization", "timeclock", "appearance"] as const) {
      assert.ok(administration?.sectionIds.includes(sectionId));
    }
    assert.equal(operation?.sectionIds.includes("organization"), false);
    assert.equal(administration?.sectionIds.includes("distributors"), false);
  });
});
