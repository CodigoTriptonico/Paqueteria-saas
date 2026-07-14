import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("inline picker and combobox share one floating lifecycle", async () => {
  const [pickerSource, lifecycleSource] = await Promise.all([
    readFile(new URL("../components/inline-search-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../hooks/use-floating-picker-lifecycle.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(pickerSource.match(/useFloatingPickerLifecycle\(\{/g)?.length, 2);
  assert.doesNotMatch(pickerSource, /function handlePointerDown/);
  assert.match(lifecycleSource, /requestAnimationFrame/);
  assert.match(lifecycleSource, /event\.key === "Escape"/);
});
