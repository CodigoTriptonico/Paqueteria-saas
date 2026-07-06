import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const pickerSource = readFileSync(
  join(process.cwd(), "src/components/inline-search-picker.tsx"),
  "utf8",
);
const enviosSource = readFileSync(
  join(process.cwd(), "src/components/envios-client.tsx"),
  "utf8",
);

describe("inline search picker panel eval", () => {
  it("sizes dropdown panels from option labels instead of truncating them", () => {
    assert.match(pickerSource, /resolveInlineSearchPanelWidth/);
    assert.match(pickerSource, /whitespace-normal break-words capitalize/);
    assert.doesNotMatch(
      pickerSource.match(/role="listbox"[\s\S]*?<\/ul>/)?.[0] || "",
      /truncate capitalize/,
    );
  });

  it("gives envios status filter enough room for bucket labels", () => {
    assert.match(enviosSource, /ENVIOS_STATUS_FILTER_OPTIONS/);
    assert.match(enviosSource, /matchesEnviosStatusFilter/);
    assert.match(enviosSource, /min-w-\[13rem\]/);
  });
});
