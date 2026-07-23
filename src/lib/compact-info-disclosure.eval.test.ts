import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../components/compact-info-disclosure.tsx", import.meta.url),
  "utf8",
);

describe("compact info disclosure eval", () => {
  it("uses one click, touch, and keyboard-accessible implementation", () => {
    assert.match(source, /type="button"/);
    assert.match(source, /aria-expanded=\{open\}/);
    assert.match(source, /aria-controls=\{open \? panelId : undefined\}/);
    assert.match(source, /event\.key !== "Escape"/);
    assert.match(source, /triggerRef\.current\?\.focus\(\)/);
  });

  it("keeps long help inside the viewport and above application surfaces", () => {
    assert.match(source, /resolveFloatingPanelPosition/);
    assert.match(source, /overflow-y-auto overflow-x-hidden/);
    assert.match(source, /\[overflow-wrap:anywhere\]/);
    assert.match(source, /z-\[280\]/);
    assert.match(source, /window\.addEventListener\("resize", updatePosition\)/);
    assert.match(source, /window\.addEventListener\("scroll", updatePosition, true\)/);
  });

  it("provides an optional title and an explicit close action", () => {
    assert.match(source, /title\?: string/);
    assert.match(source, /aria-label=\{title \?\? ariaLabel\}/);
    assert.match(source, /aria-label="Cerrar ayuda"/);
  });
});
