import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInlineSearchPanelWidth } from "@/components/inline-search-picker";
import { ENVIOS_STATUS_FILTER_OPTIONS } from "@/lib/shipment-display";

describe("resolveInlineSearchPanelWidth", () => {
  it("expands narrow triggers to fit envios status bucket labels", () => {
    const width = resolveInlineSearchPanelWidth(
      128,
      ENVIOS_STATUS_FILTER_OPTIONS.map((option) => option.label),
    );

    assert.ok(width >= 200);
    assert.ok(width >= "En tránsito".length * 6);
  });

  it("never exceeds the viewport budget", () => {
    const width = resolveInlineSearchPanelWidth(
      128,
      ["En tránsito"],
      320,
    );

    assert.ok(width <= 304);
    assert.ok(width > 128);
  });
});
