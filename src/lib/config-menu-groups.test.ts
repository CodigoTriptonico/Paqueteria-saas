import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONFIG_MENU_GROUPS, CONFIG_MENU_SECTION_IDS } from "./config-menu-groups";

const EXPECTED_SECTIONS = [
  "plan",
  "prices",
  "distributors",
  "inventory",
  "deliveries",
  "appearance",
  "company",
  "users",
] as const;

describe("config menu groups", () => {
  it("covers every configuration section exactly once", () => {
    assert.deepEqual([...CONFIG_MENU_SECTION_IDS].sort(), [...EXPECTED_SECTIONS].sort());
    assert.equal(CONFIG_MENU_SECTION_IDS.length, EXPECTED_SECTIONS.length);
  });

  it("keeps operation and administration balanced for the landing grid", () => {
    assert.equal(CONFIG_MENU_GROUPS.length, 2);
    assert.equal(CONFIG_MENU_GROUPS[0]?.sectionIds.length, 4);
    assert.equal(CONFIG_MENU_GROUPS[1]?.sectionIds.length, 4);
  });

  it("groups operation settings before administration settings", () => {
    assert.equal(CONFIG_MENU_GROUPS[0]?.id, "operation");
    assert.equal(CONFIG_MENU_GROUPS[1]?.id, "administration");
    assert.ok(CONFIG_MENU_GROUPS[0]?.sectionIds.includes("inventory"));
    assert.ok(CONFIG_MENU_GROUPS[1]?.sectionIds.includes("users"));
  });
});
