import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);
const shipmentsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);

describe("scheduled leg auto-order eval", () => {
  it("orders the driver task only inside an explicit route decision", () => {
    assert.match(
      enviosSource,
      /async function confirmProgramRoute[\s\S]*?DriverTaskOrdered: true/,
    );
    assert.match(
      enviosSource,
      /async function confirmPendingRoute[\s\S]*?DriverTaskOrdered: true/,
    );
  });

  it("does not auto-order driver tasks when listing shipments", () => {
    assert.match(shipmentsSource, /promoteDueScheduledLegsForListedShipments/);
    assert.doesNotMatch(
      shipmentsSource,
      /buildDueSchedulePromotionInput[\s\S]*?driverTaskOrdered:\s*true/,
    );
  });
});
