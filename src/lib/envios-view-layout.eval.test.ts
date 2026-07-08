import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enviosSource = readFileSync(join(root, "components/envios-client.tsx"), "utf8");
const hookSource = readFileSync(join(root, "hooks/use-view-layout.ts"), "utf8");

describe("envios view layout eval", () => {
  it("exposes a toolbar toggle between row and card layouts", () => {
    assert.equal(enviosSource.includes("useEnviosViewLayout"), true);
    assert.equal(enviosSource.includes("onViewLayoutToggle"), true);
    assert.equal(enviosSource.includes("ViewLayoutToggle"), true);
    assert.equal(enviosSource.includes('viewLayout === "rows"'), true);
  });

  it("renders both shipment list layouts from envios-client", () => {
    assert.equal(enviosSource.includes("EnviosShipmentRowsList"), true);
    assert.equal(enviosSource.includes("EnviosShipmentCardsGrid"), true);
    assert.equal(enviosSource.includes("divide-y divide-black/70"), true);
    assert.equal(enviosSource.includes("sm:grid-cols-2 xl:grid-cols-3"), true);
    assert.equal(enviosSource.includes("expandedShipmentIds"), true);
    assert.equal(enviosSource.includes("toggleShipmentExpanded"), true);
  });

  it("persists the selected layout in local storage", () => {
    assert.equal(hookSource.includes("readViewLayout"), true);
    assert.equal(hookSource.includes("writeViewLayout"), true);
    assert.equal(hookSource.includes("toggleViewLayout"), true);
  });
});
