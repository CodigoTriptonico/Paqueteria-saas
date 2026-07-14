import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enviosSource = readFileSync(join(root, "components/envios-client.tsx"), "utf8");
const sidebarControls = readFileSync(
  join(root, "components/ui/sidebar-page-surface-controls.tsx"),
  "utf8",
);

describe("envios view layout eval", () => {
  it("reads view layout from per-page preferences and toggles in sidebar", () => {
    assert.equal(enviosSource.includes('usePageViewLayout("shipments.tracking")'), true);
    assert.equal(enviosSource.includes("onViewLayoutToggle"), false);
    assert.equal(enviosSource.includes("ViewLayoutToggle"), false);
    assert.equal(sidebarControls.includes("ViewLayoutToggle"), true);
    assert.equal(enviosSource.includes('viewLayout === "rows"'), true);
  });

  it("renders both shipment list layouts with shared page palette", () => {
    assert.equal(enviosSource.includes("EnviosShipmentRowsList"), true);
    assert.equal(enviosSource.includes("EnviosShipmentCardsGrid"), true);
    assert.equal(enviosSource.includes("divide-y divide-black/70"), false);
    assert.equal(enviosSource.includes("listRowBaseClass"), true);
    assert.equal(enviosSource.includes("listCardShellClass"), true);
    assert.equal(enviosSource.includes("flex flex-col gap-2"), true);
    assert.equal(enviosSource.includes("sm:grid-cols-2 xl:grid-cols-3"), true);
    assert.equal(enviosSource.includes("expandedShipmentIds"), true);
    assert.equal(enviosSource.includes("toggleShipmentExpanded"), true);
  });
});
