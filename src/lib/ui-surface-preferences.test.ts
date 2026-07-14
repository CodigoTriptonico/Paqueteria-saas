import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UI_SURFACE_CONTEXT_IDS } from "./ui-surface-context.ts";
import {
  defaultUiSurfacePreferences,
  addCustomPaletteToPreferences,
  defaultPaletteIdForContext,
  paletteIdForContext,
  resetAllContextPalettes,
  resetPaletteForContext,
  setPaletteForContext,
  UI_SURFACE_PREFERENCES_STORAGE_KEY,
} from "./ui-surface-preferences.ts";

describe("ui surface preferences", () => {
  it("stores a palette per surface context", () => {
    const defaults = defaultUiSurfacePreferences();
    for (const contextId of UI_SURFACE_CONTEXT_IDS) {
      assert.ok(paletteIdForContext(defaults, contextId));
    }
  });

  it("updates one context without touching the others", () => {
    const base = defaultUiSurfacePreferences();
    const next = setPaletteForContext(base, "shipments.tracking", "sapphire");
    assert.equal(paletteIdForContext(next, "shipments.tracking"), "sapphire");
    assert.equal(paletteIdForContext(next, "logistics.tasks"), paletteIdForContext(base, "logistics.tasks"));
  });

  it("ignores invalid palette or context ids", () => {
    const base = defaultUiSurfacePreferences();
    const next = setPaletteForContext(base, "not-real" as "logistics.tasks", "sapphire");
    assert.deepEqual(next.byContext, base.byContext);
  });

  it("uses a versioned localStorage key", () => {
    assert.equal(UI_SURFACE_PREFERENCES_STORAGE_KEY, "boxario-ui-surfaces:v2");
  });

  it("accepts custom palette references in byContext", () => {
    const custom = {
      id: "custom:test-1",
      label: "Mío",
      baseHex: "#112233",
      hoverHex: "#223344",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const base = defaultUiSurfacePreferences();
    const withCustom = addCustomPaletteToPreferences(base, custom);
    const next = setPaletteForContext(withCustom, "logistics.tasks", custom.id);
    assert.equal(paletteIdForContext(next, "logistics.tasks"), custom.id);
  });

  it("resets one page palette without touching others", () => {
    const base = setPaletteForContext(
      defaultUiSurfacePreferences(),
      "shipments.tracking",
      "sapphire",
    );
    const next = setPaletteForContext(base, "logistics.tasks", "emerald-vivid");
    const reset = resetPaletteForContext(next, "logistics.tasks");

    assert.equal(
      paletteIdForContext(reset, "logistics.tasks"),
      defaultPaletteIdForContext("logistics.tasks"),
    );
    assert.equal(paletteIdForContext(reset, "shipments.tracking"), "sapphire");
  });

  it("resets all page palettes to defaults", () => {
    const base = setPaletteForContext(
      setPaletteForContext(defaultUiSurfacePreferences(), "logistics.tasks", "sapphire"),
      "shipments.tracking",
      "ruby-vivid",
    );
    const reset = resetAllContextPalettes(base);

    assert.equal(
      paletteIdForContext(reset, "logistics.tasks"),
      defaultPaletteIdForContext("logistics.tasks"),
    );
    assert.equal(
      paletteIdForContext(reset, "shipments.tracking"),
      defaultPaletteIdForContext("shipments.tracking"),
    );
  });
});
