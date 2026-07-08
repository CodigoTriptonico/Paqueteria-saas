import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);

const triggerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-milestone-age-strip.tsx"),
  "utf8",
);

describe("shipment milestone age strip eval", () => {
  it("uses a clock icon trigger instead of an always-visible strip", () => {
    assert.equal(enviosSource.includes("buildShipmentMilestoneAges(row, progressSteps)"), true);
    assert.equal(enviosSource.includes("ShipmentMilestoneAgeTrigger ages={milestoneAges} className=\"self-center\""), true);
    assert.equal(triggerSource.includes("Clock"), true);
    assert.equal(triggerSource.includes("milestoneAgeIndicatorButtonClass(ages)"), true);
    assert.equal(triggerSource.includes("createPortal"), true);
    assert.equal(triggerSource.includes("{age.label}"), true);
    assert.equal(triggerSource.includes("milestoneAgeDisplayValue(age)"), true);
    assert.doesNotMatch(triggerSource, /grid-cols-3/);
  });
});
