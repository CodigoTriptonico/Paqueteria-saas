import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const contextMenuSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/shipment-step-context-menu.tsx"),
  "utf8",
);
const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);

describe("logistics action confirm eval", () => {
  it("asks before canceling driver legs or changing route assignments", () => {
    assert.equal(contextMenuSource.includes("requestCancelPickup"), true);
    assert.equal(contextMenuSource.includes("requestCancelDelivery"), true);
    assert.equal(contextMenuSource.includes("logisticsLegCancelCopy"), true);
    assert.equal(logisticaSource.includes("requestRouteDriverChange"), true);
    assert.equal(logisticaSource.includes("requestCancelRoute"), true);
    assert.equal(logisticaSource.includes("requestRemoveStop"), true);
    assert.equal(logisticaSource.includes("shouldConfirmDriverChange"), true);
    assert.equal(logisticaSource.includes("ActionConfirmDialog"), true);
  });
});
