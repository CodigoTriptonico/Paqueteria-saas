import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "shipment-display.ts"),
  "utf8",
);

const shipmentLogisticsStepsBody =
  source.match(/export function shipmentLogisticsSteps[\s\S]*?\n}\n\nexport function shipmentStatusDisplayLabel/)?.[0] ?? "";

describe("shipment consistent steps eval", () => {
  it("does not give empty-box deposits a shorter progress path", () => {
    assert.equal(shipmentLogisticsStepsBody.includes('row.sale_kind === "empty_box_deposit"'), false);
    assert.equal(shipmentLogisticsStepsBody.includes("rawSteps = [sale, empty];"), false);
    assert.equal(shipmentLogisticsStepsBody.includes("const rawSteps"), true);
    assert.equal(shipmentLogisticsStepsBody.includes("sale,"), false);
    assert.equal(shipmentLogisticsStepsBody.includes("withDriverTaskOrdered(row, full)"), true);
    assert.equal(shipmentLogisticsStepsBody.includes("...postFullBoxSteps(row, fullDone)"), true);
    assert.equal(source.includes("Orden pendiente en envíos"), true);
  });

  it("keeps the visible path operational only", () => {
    assert.equal(source.includes("function saleStep"), false);
    assert.equal(source.includes("function officeTransitStep"), false);
    assert.equal(source.includes("title: FULL_BOX_LEG_LABELS.short"), true);
  });
});
