import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ventaSource = readFileSync(join(root, "components/venta-client.tsx"), "utf8");
const senderListSource = readFileSync(join(root, "components/sale/sale-sender-list.tsx"), "utf8");
const recipientListSource = readFileSync(join(root, "components/sale/sale-recipient-list.tsx"), "utf8");
const hookSource = readFileSync(join(root, "hooks/use-view-layout.ts"), "utf8");

describe("venta view layout eval", () => {
  it("shares the persisted view layout between remitentes and destinatarios", () => {
    assert.equal(ventaSource.includes("useViewLayout"), true);
    assert.equal(ventaSource.includes("viewLayout={viewLayout}"), true);
    assert.equal(ventaSource.includes("onViewLayoutToggle={toggleViewLayout}"), true);
    assert.equal(senderListSource.includes("SalePersonListToolbar"), true);
    assert.equal(ventaSource.includes("SalePersonListToolbar"), true);
  });

  it("renders both row and card person lists in venta", () => {
    assert.equal(senderListSource.includes('viewLayout === "rows"'), true);
    assert.equal(senderListSource.includes("SalePersonRow"), true);
    assert.equal(senderListSource.includes("SalePersonCard"), true);
    assert.equal(senderListSource.includes("flowPersonCardGridClass"), true);
    assert.equal(recipientListSource.includes('viewLayout === "rows"'), true);
    assert.equal(recipientListSource.includes("SalePersonAddRow"), true);
    assert.equal(recipientListSource.includes("SalePersonAddCard"), true);
  });

  it("persists the selected layout in local storage", () => {
    assert.equal(hookSource.includes("readViewLayout"), true);
    assert.equal(hookSource.includes("writeViewLayout"), true);
    assert.equal(hookSource.includes("toggleViewLayout"), true);
  });
});
