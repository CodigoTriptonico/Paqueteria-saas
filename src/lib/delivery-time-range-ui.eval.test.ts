import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const configClient = readFileSync(
  join(process.cwd(), "src/components/configuracion-client.tsx"),
  "utf8",
);

describe("delivery time range ui eval", () => {
  it("keeps two-digit delivery ranges on one line", () => {
    assert.match(configClient, /function TimeRangeSelect/);
    assert.match(configClient, /numberButtonClass/);
    assert.match(configClient, /whitespace-nowrap/);
    assert.match(configClient, /tabular-nums/);
    assert.match(configClient, /flex-nowrap/);
    assert.doesNotMatch(configClient, /numberWidth = large \? "w-14" : "w-12"/);
  });
});
