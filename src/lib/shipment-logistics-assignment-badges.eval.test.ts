import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/shipment-logistics-assignment-badges.tsx",
  ),
  "utf8",
);

describe("shipment logistics assignment badges eval", () => {
  it("renders compact route and driver chips with ready styling", () => {
    assert.equal(source.includes("ShipmentLogisticsAssignmentBadges"), true);
    assert.equal(source.includes("Ruta no asignada"), false);
    assert.equal(source.includes("assignment.routeLabel"), true);
    assert.equal(source.includes("assignment.driverLabel"), true);
    assert.equal(source.includes("CalendarClock"), false);
    assert.equal(source.includes("scheduleLabel"), false);
    assert.equal(source.includes("border-emerald-600/50"), true);
    assert.equal(source.includes("truncate"), false);
    assert.equal(source.includes("max-w-["), false);
    assert.equal(source.includes("whitespace-nowrap"), true);
  });
});
