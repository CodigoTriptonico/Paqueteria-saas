import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shellSource = readFileSync(join(root, "components/app-shell.tsx"), "utf8");
const frameSource = readFileSync(join(root, "components/app-frame.tsx"), "utf8");

describe("envios nav eval", () => {
  it("shows one unified shipment workspace in the sidebar", () => {
    const seguimientoIndex = shellSource.indexOf('{ label: "Seguimiento y envíos", href: "/seguimiento"');

    assert.ok(seguimientoIndex >= 0);
    assert.equal(shellSource.includes('/seguimiento/historial"'), false);
    assert.equal(shellSource.includes('/auditoria"'), false);
    assert.equal(shellSource.includes('{ label: "Envios", href: "/seguimiento"'), false);
  });

  it("maps the unified workspace to the active shell label", () => {
    const seguimientoCheckIndex = frameSource.indexOf('pathname.startsWith("/seguimiento")');

    assert.ok(seguimientoCheckIndex >= 0);
    assert.match(frameSource, /return "Seguimiento y envíos"/);
    assert.doesNotMatch(frameSource, /return "Envios"/);
  });

  it("redirects legacy /envios URLs to /seguimiento", async () => {
    const nextConfigSource = readFileSync(
      join(root, "..", "next.config.ts"),
      "utf8",
    );

    assert.match(nextConfigSource, /source: "\/envios\/historial"/);
    assert.match(nextConfigSource, /destination: "\/seguimiento\?view=history"/);
    assert.match(nextConfigSource, /source: "\/envios"/);
    assert.match(nextConfigSource, /destination: "\/seguimiento"/);
  });
});
