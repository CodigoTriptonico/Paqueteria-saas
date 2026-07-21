import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const ventaSource = readFileSync(join(root, "src/components/venta-client.tsx"), "utf8");
const dialogSource = readFileSync(
  join(root, "src/components/sale/sale-invoice-confirm-dialog.tsx"),
  "utf8",
);

describe("invoice creation feedback", () => {
  it("keeps the confirmation modal open and exposes action failures", () => {
    assert.match(ventaSource, /catch \(error\)/);
    assert.match(ventaSource, /setStockMessage\(message\)/);
    assert.match(ventaSource, /notify\.error\(message\)/);
    assert.match(ventaSource, /errorMessage=\{stockMessage\}/);
    assert.match(dialogSource, /role="alert"/);
  });
});
