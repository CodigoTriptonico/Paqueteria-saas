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
    const seguimientoIndex = shellSource.indexOf('{ label: "Seguimiento", href: "/envios"');
    const historialIndex = shellSource.indexOf(
      '{ label: "Historial envíos", href: "/envios/historial"',
    );

    assert.ok(seguimientoIndex >= 0);
    assert.ok(historialIndex > seguimientoIndex);
    assert.equal(shellSource.includes('{ label: "Envios", href: "/envios"'), false);
  });

  it("maps pathname to the correct active shell label", () => {
    const historialCheckIndex = frameSource.indexOf('pathname.startsWith("/envios/historial")');
    const seguimientoCheckIndex = frameSource.indexOf('pathname.startsWith("/envios")');

    assert.ok(historialCheckIndex >= 0);
    assert.ok(seguimientoCheckIndex > historialCheckIndex);
    assert.match(frameSource, /return "Historial envíos"/);
    assert.match(frameSource, /return "Seguimiento"/);
    assert.doesNotMatch(frameSource, /return "Envios"/);
  });
});
