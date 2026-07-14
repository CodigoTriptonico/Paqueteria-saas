import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomUiSurfacePalette,
  createCustomPalette,
  isCustomPaletteId,
} from "./ui-surface-custom-palettes.ts";

describe("ui surface custom palettes", () => {
  it("creates custom palette ids with prefix", () => {
    const custom = createCustomPalette({ label: "Rojo mío", baseHex: "#a83252" });
    assert.ok(custom);
    assert.equal(isCustomPaletteId(custom!.id), true);
    assert.equal(custom!.hoverHex.length, 7);
  });

  it("builds runtime palettes that use css var row classes", () => {
    const custom = createCustomPalette({ label: "Test", baseHex: "#123456" })!;
    const palette = buildCustomUiSurfacePalette(custom);
    assert.equal(palette.listRow.hex, "#123456");
    assert.equal(palette.listRow.rowClass, "bg-surface-list-row");
    assert.ok(palette.personCardId);
  });
});
