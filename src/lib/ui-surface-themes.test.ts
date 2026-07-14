import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paletteIdsForTheme } from "./ui-surface-themes.ts";

describe("ui surface themes", () => {
  it("filters catalog ids by vivid theme", () => {
    const ids = paletteIdsForTheme("vivid", [
      "sapphire",
      "amber-warm",
      "slate-cold",
      "emerald-vivid",
    ]);
    assert.deepEqual(ids, ["sapphire", "emerald-vivid"]);
  });

  it("returns full catalog for all theme", () => {
    const catalog = ["a", "b", "c"];
    assert.deepEqual(paletteIdsForTheme("all", catalog), catalog);
  });
});
