import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);

describe("envios page layout eval", () => {
  it("keeps envios inside the desktop shell instead of growing the page", () => {
    assert.equal(
      enviosSource.includes('className="flex min-h-0 flex-col lg:flex-1 lg:overflow-hidden"'),
      true,
    );
    assert.equal(
      enviosSource.includes('contentClassName="flex min-h-0 flex-1 flex-col p-3 sm:p-4"'),
      true,
    );
    assert.equal(
      enviosSource.includes('className="mb-3 shrink-0 rounded-xl border border-black bg-surface-card-header p-2"'),
      true,
    );
    assert.equal(
      enviosSource.includes('className="min-h-0 flex-1 overflow-y-auto pr-1"'),
      true,
    );
  });
});
