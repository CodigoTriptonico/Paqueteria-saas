import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const controlsSource = readFileSync(
  join(process.cwd(), "src", "components", "ui", "sidebar-page-surface-controls.tsx"),
  "utf8",
);

describe("sidebar footer controls", () => {
  it("uses action icons instead of implying a false expansion direction", () => {
    assert.match(controlsSource, /SlidersHorizontal/);
    assert.match(controlsSource, /<X className="h-4 w-4 shrink-0"/);
    assert.doesNotMatch(controlsSource, /ChevronsUp|ChevronsDown/);
    assert.match(controlsSource, /Mostrar opciones de vista y apariencia/);
    assert.match(controlsSource, /Ocultar opciones de vista y apariencia/);
  });
});
