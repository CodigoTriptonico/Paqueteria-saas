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

describe("invoice creation feedback eval", () => {
  it("makes a failed create attempt observable to a counter operator", () => {
    assert.match(
      ventaSource,
      /setStockMessage\("Configura Supabase en \.env\.local para crear invoices abiertos\."\)/,
    );
    assert.match(ventaSource, /setStockMessage\(invoiceResult\.error\)/);
    assert.match(ventaSource, /setStockMessage\(shipmentResult\.error\)/);
    assert.match(dialogSource, /errorMessage\?: string/);
    assert.match(dialogSource, /errorMessage \? \(/);
  });
});
