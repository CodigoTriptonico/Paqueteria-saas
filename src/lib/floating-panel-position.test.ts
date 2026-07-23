import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFloatingPanelPosition } from "./floating-panel-position";

describe("floating panel position", () => {
  it("opens below the trigger when there is room", () => {
    assert.deepEqual(
      resolveFloatingPanelPosition({
        trigger: { top: 40, right: 80, bottom: 72, left: 48 },
        panelWidth: 280,
        panelHeight: 180,
        viewportWidth: 1024,
        viewportHeight: 768,
        align: "left",
      }),
      { top: 80, left: 48, width: 280, maxHeight: 744 },
    );
  });

  it("flips above and clamps horizontally near the viewport edge", () => {
    assert.deepEqual(
      resolveFloatingPanelPosition({
        trigger: { top: 700, right: 1010, bottom: 732, left: 978 },
        panelWidth: 320,
        panelHeight: 220,
        viewportWidth: 1024,
        viewportHeight: 768,
        align: "right",
      }),
      { top: 472, left: 690, width: 320, maxHeight: 744 },
    );
  });

  it("fits narrow mobile screens without horizontal overflow", () => {
    const position = resolveFloatingPanelPosition({
      trigger: { top: 120, right: 308, bottom: 152, left: 276 },
      panelWidth: 320,
      panelHeight: 500,
      viewportWidth: 320,
      viewportHeight: 568,
      align: "right",
    });

    assert.deepEqual(position, { top: 56, left: 12, width: 296, maxHeight: 544 });
    assert.ok(position.left + position.width <= 308);
  });
});
