import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateRouteStopEtaMinutes, formatEtaMinutes } from "@/lib/logistics-eta";

describe("logistics-eta", () => {
  it("estimates naive stop eta", () => {
    assert.equal(estimateRouteStopEtaMinutes(3), 75);
    assert.equal(formatEtaMinutes(75), "1 h 15 min");
  });
});
