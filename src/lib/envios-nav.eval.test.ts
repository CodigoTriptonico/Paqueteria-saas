import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shellSource = readFileSync(join(root, "components/app-shell.tsx"), "utf8");
const frameSource = readFileSync(join(root, "components/app-frame.tsx"), "utf8");

describe("envios nav eval", () => {
  it("shows Seguimiento and Historial envíos in the sidebar", () => {
    const seguimientoIndex = shellSource.indexOf('{ label: "Seguimiento", href: "/seguimiento"');
    const historialIndex = shellSource.indexOf(
      '{ label: "Historial envíos", href: "/seguimiento/historial"',
    );

    assert.ok(seguimientoIndex >= 0);
    assert.ok(historialIndex > seguimientoIndex);
    assert.equal(shellSource.includes('{ label: "Envios", href: "/seguimiento"'), false);
  });

  it("maps pathname to the correct active shell label", () => {
    const historialCheckIndex = frameSource.indexOf('pathname.startsWith("/seguimiento/historial")');
    const seguimientoCheckIndex = frameSource.indexOf('pathname.startsWith("/seguimiento")');

    assert.ok(historialCheckIndex >= 0);
    assert.ok(seguimientoCheckIndex > historialCheckIndex);
    assert.match(frameSource, /return "Historial envíos"/);
    assert.match(frameSource, /return "Seguimiento"/);
    assert.doesNotMatch(frameSource, /return "Envios"/);
  });

  it("redirects legacy /envios URLs to /seguimiento", async () => {
    const nextConfigSource = readFileSync(
      join(root, "..", "next.config.ts"),
      "utf8",
    );

    assert.match(nextConfigSource, /source: "\/envios\/historial"/);
    assert.match(nextConfigSource, /destination: "\/seguimiento\/historial"/);
    assert.match(nextConfigSource, /source: "\/envios"/);
    assert.match(nextConfigSource, /destination: "\/seguimiento"/);
  });
});
