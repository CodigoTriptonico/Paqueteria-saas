import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "components/conductor/conductor-tareas-client.tsx"),
  "utf8",
);

describe("conductor tareas compact UI", () => {
  it("keeps admin selection inside the operational toolbar", () => {
    const toolbarStart = source.indexOf('<section className="mb-3 flex flex-wrap items-center gap-2');
    const pickerIndex = source.indexOf("<InlineSearchPicker", toolbarStart);
    const toolbarEnd = source.indexOf("</section>", toolbarStart);

    assert.ok(toolbarStart >= 0);
    assert.ok(pickerIndex > toolbarStart);
    assert.ok(toolbarEnd > pickerIndex);
  });

  it("labels every compact row action with plain language", () => {
    assert.match(source, />\s*Maps\s*</);
    assert.match(source, />\s*Llamar\s*</);
    assert.match(source, />\s*Listo\s*</);
    assert.match(source, />\s*No se pudo\s*</);
    assert.match(source, />\s*Reintentar\s*</);
  });

  it("uses disclosures for secondary information", () => {
    assert.match(source, /function CompactInfoDisclosure/);
    assert.match(source, /ariaLabel="Ver destinatario"/);
    assert.match(source, /ariaLabel="Ver más información"/);
  });
});
