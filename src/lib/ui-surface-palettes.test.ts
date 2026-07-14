import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyListRowCssVariables,
  DEFAULT_LIST_ROW_PALETTE_ID,
  DEFAULT_PERSON_CARD_PALETTE_ID,
  resolveUiSurfacePalette,
  UI_SURFACE_PALETTES,
  uiSurfacePalettesForKind,
} from "./ui-surface-palettes.ts";

describe("ui surface palettes", () => {
  it("exposes list palettes and person-card variants in one catalog", () => {
    assert.ok(UI_SURFACE_PALETTES.length >= 15);
    const listOnly = uiSurfacePalettesForKind("listRow");
    const person = uiSurfacePalettesForKind("personCard");
    assert.ok(listOnly.length >= 15);
    assert.ok(person.length >= 10);
    assert.ok(person.every((palette) => palette.personCardId));
  });

  it("falls back to the default list palette for unknown ids", () => {
    const palette = resolveUiSurfacePalette("not-a-real-palette");
    assert.equal(palette.id, DEFAULT_LIST_ROW_PALETTE_ID);
  });

  it("resolves the default person card palette", () => {
    const palette = resolveUiSurfacePalette(DEFAULT_PERSON_CARD_PALETTE_ID);
    assert.equal(palette.personCardId, "amber-warm");
  });

  it("writes list row css variables on a root element", () => {
    const palette = resolveUiSurfacePalette("sapphire");
    const root = { style: { setProperty: () => {}, removeProperty: () => {} } } as unknown as HTMLElement;
    let row = "";
    let hover = "";
    root.style.setProperty = (name, value) => {
      if (name === "--surface-list-row") row = value ?? "";
      if (name === "--surface-list-row-hover") hover = value ?? "";
    };
    applyListRowCssVariables(palette, root);
    assert.equal(row, "#1e4a9e");
    assert.equal(hover, "#2563c4");
  });
});
