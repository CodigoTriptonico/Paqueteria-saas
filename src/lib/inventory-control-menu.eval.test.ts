import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/inventory/inventory-control-menu.tsx"),
  "utf8",
);

describe("inventory control menu eval", () => {
  it("opens one Seguimiento entry that hosts custody, assignments and history", () => {
    assert.match(source, /InventoryTrackingDrawer/);
    assert.match(source, /Seguimiento/);
    assert.doesNotMatch(source, /Asignaciones activas/);
    assert.doesNotMatch(source, /Historial de movimientos/);
    assert.match(source, /LocateFixed/);
  });
});
