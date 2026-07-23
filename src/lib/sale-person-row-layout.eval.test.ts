import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const senderListSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-sender-list.tsx"),
  "utf8",
);
const recipientListSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-recipient-list.tsx"),
  "utf8",
);
const personCardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-person-card.tsx"),
  "utf8",
);
const flowStylesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/flow-form-styles.ts"),
  "utf8",
);
const ventaClientSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/venta-client.tsx"),
  "utf8",
);

describe("sale person row layout eval", () => {
  it("supports row and card layouts for senders and recipients", () => {
    assert.equal(flowStylesSource.includes("flowPersonRowListFrameClass"), true);
    assert.equal(flowStylesSource.includes("flowPersonCardGridClass"), true);
    assert.equal(flowStylesSource.includes("divide-y divide-black/70"), true);
    assert.equal(senderListSource.includes("flowPersonRowListSlotClass"), true);
    assert.equal(senderListSource.includes("flowPersonRowListFrameClass"), true);
    assert.equal(senderListSource.includes("SalePersonListToolbar"), true);
    assert.equal(senderListSource.includes("SalePersonRow"), true);
    assert.equal(senderListSource.includes("SalePersonCard"), true);
    assert.equal(senderListSource.includes('viewLayout === "rows"'), true);
    assert.equal(senderListSource.includes("onViewLayoutToggle"), false);
    assert.equal(recipientListSource.includes("SalePersonRow"), true);
    assert.equal(recipientListSource.includes("SalePersonCard"), true);
    assert.equal(recipientListSource.includes("flowPersonRowListSlotClass"), true);
    assert.equal(recipientListSource.includes("SalePersonAddRow"), false);
    assert.equal(recipientListSource.includes("SalePersonAddCard"), false);
    assert.equal(recipientListSource.includes('viewLayout === "rows"'), true);
  });

  it("scrolls person lists inside the viewport while toolbar stays fixed", () => {
    assert.equal(flowStylesSource.includes("flex min-h-0 w-full flex-1 flex-col overflow-hidden"), true);
    assert.equal(flowStylesSource.includes("overflow-y-auto"), true);
    assert.equal(ventaClientSource.includes("boundedPersonListLayout"), true);
    assert.equal(senderListSource.includes("useSalePersonRowsPerPage"), false);
    assert.equal(recipientListSource.includes("useSalePersonRowsPerPage"), false);
    assert.equal(senderListSource.includes(".slice("), false);
    assert.equal(recipientListSource.includes(".slice("), false);
  });

  it("keeps compact row grid aligned like envios", () => {
    assert.equal(
      personCardSource.includes(
        "grid-cols-[2.5rem_minmax(0,1fr)_auto]",
      ),
      true,
    );
    assert.equal(personCardSource.includes("divide-y"), false);
    assert.equal(personCardSource.includes("salePersonAddressSummary"), true);
    assert.match(
      personCardSource,
      /inline-flex h-9 items-center[\s\S]*?sm:h-10[\s\S]*?>\s*<Package[\s\S]*?>\s*<span>Rápido<\/span>/,
    );
  });

  it("uses row-specific selection classes in venta", () => {
    assert.equal(ventaClientSource.includes("contextPersonClass"), true);
    assert.equal(ventaClientSource.includes("salePersonRowSelectedClass"), true);
    assert.equal(ventaClientSource.includes("salePersonRowContextActiveClass"), true);
    assert.equal(ventaClientSource.includes("selectedCardClass"), true);
    assert.equal(ventaClientSource.includes("usePageViewLayout(saleListPaletteContext)"), true);
  });

  it("shows person list total in toolbar without pagination", () => {
    assert.equal(flowStylesSource.includes("flowPersonToolbarCountClass"), true);
    assert.equal(senderListSource.includes("countLabel={countLabel}"), true);
    assert.equal(recipientListSource.includes("SalePersonListFooter"), false);
    assert.equal(senderListSource.includes("formatSalePersonListCount"), true);
    assert.equal(ventaClientSource.includes("formatSalePersonListCount"), true);
    assert.equal(ventaClientSource.includes("recipientCountLabel"), true);
    assert.equal(senderListSource.includes("onPageChange"), false);
    assert.equal(recipientListSource.includes("onPageChange"), false);
    assert.equal(ventaClientSource.includes("senderPage"), false);
    assert.equal(ventaClientSource.includes("recipientPage"), false);
  });

  it("keeps sender toolbar search and actions in one compact shell", () => {
    assert.equal(flowStylesSource.includes("flowPersonToolbarShellClass"), true);
    assert.equal(flowStylesSource.includes("flowPersonToolbarSearchSlotClass"), true);
    assert.match(
      flowStylesSource,
      /flowPersonToolbarShellClass =\s*\n\s*"[^"]*overflow-hidden[^"]*"/,
    );
    assert.doesNotMatch(
      flowStylesSource,
      /flowPersonToolbarShellClass =\s*\n\s*"[^"]*overflow-x-auto/,
    );
    assert.match(flowStylesSource, /flowPersonToolbarRecentsClass[\s\S]*?scrollbar-width:none/);
    assert.equal(senderListSource.includes("flowPersonToolbarSearchShellClass"), true);
    assert.equal(senderListSource.includes("SalePersonListToolbar"), true);
  });
});
