import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveQuickSaleBoxCatalog } from "@/lib/sale-quick-box-catalog";

describe("quick sale box catalog", () => {
  it("uses the only configured country instead of assuming USA exists", () => {
    assert.deepEqual(
      resolveQuickSaleBoxCatalog({
        México: [["18x18x18", "$200"]],
      }),
      {
        country: "México",
        boxes: [["18x18x18", "$200"]],
      },
    );
  });

  it("keeps the preferred catalog when it has priced boxes", () => {
    assert.equal(
      resolveQuickSaleBoxCatalog({
        México: [["18x18x18", "$200"]],
        USA: [["20x20x20", "$250"]],
      })?.country,
      "USA",
    );
  });

  it("ignores empty countries and reports a real empty catalog", () => {
    assert.equal(resolveQuickSaleBoxCatalog({ USA: [], México: [] }), null);
    assert.equal(
      resolveQuickSaleBoxCatalog({ USA: [], México: [["19x19x19", "$300"]] })?.country,
      "México",
    );
  });
});
