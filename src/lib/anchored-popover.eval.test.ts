import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shipment detail triggers share anchored popover behavior", async () => {
  const [boxesTrigger, timingTrigger, hook] = await Promise.all([
    readFile(new URL("../components/shipment-box-lines-trigger.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/shipment-milestone-age-strip.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../hooks/use-anchored-popover.ts", import.meta.url), "utf8"),
  ]);

  assert.match(boxesTrigger, /useAnchoredPopover\(PANEL_WIDTH\)/);
  assert.match(timingTrigger, /useAnchoredPopover\(PANEL_WIDTH\)/);
  assert.match(hook, /window\.addEventListener\("scroll", updatePosition, true\)/);
  assert.match(hook, /event\.key === "Escape"/);
  assert.doesNotMatch(boxesTrigger, /function updatePosition/);
  assert.doesNotMatch(timingTrigger, /function updatePosition/);
});
