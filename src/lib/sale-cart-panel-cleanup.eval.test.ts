import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "src/components/sale/sale-cart-panel.tsx"),
  "utf8",
);

describe("sale cart panel cleanup eval", () => {
  it("keeps only the cart components used by venta", () => {
    assert.match(source, /export function SaleCartPanel\(/);
    assert.match(source, /export function SaleStepCartTrigger\(/);
    assert.doesNotMatch(
      source,
      /SaleCart(?:Drawer|Rail|MobileChip|BottomBar|Dock|IconButton|MobileDrawer|FloatingTrigger)/,
    );
  });

  it("does not retain portal or lifecycle code from the removed cart variants", () => {
    assert.doesNotMatch(source, /createPortal|useEffect|useState/);
  });
});
