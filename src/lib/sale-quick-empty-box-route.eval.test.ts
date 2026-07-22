import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const modalSource = readFileSync(
  join(root, "src/components/sale/sale-quick-empty-box-modal.tsx"),
  "utf8",
);
const fieldSource = readFileSync(
  join(root, "src/components/sale/sale-payment-method-field.tsx"),
  "utf8",
);
const saleSource = readFileSync(join(root, "src/components/venta-client.tsx"), "utf8");
const checkoutSource = readFileSync(
  join(root, "src/components/sale/sale-quick-checkout-modal.tsx"),
  "utf8",
);
const catalogSource = readFileSync(
  join(root, "src/lib/sale-quick-box-catalog.ts"),
  "utf8",
);

describe("quick empty-box route workflow", () => {
  it("uses the company route calendar instead of a free date field", () => {
    assert.match(modalSource, /onRequestRoute/);
    assert.match(modalSource, /Elegir día y ruta/);
    assert.doesNotMatch(modalSource, /DateInput|ScheduleTimeField/);
    assert.match(saleSource, /openRoutePlanner\("quickEmptyBox"\)/);
    assert.match(saleSource, /routePlannerLeg === "fullBox" \? "Programar recolección" : "Programar entrega"/);
    assert.match(saleSource, /enabledDays=\{routeCatalog\.enabledDays\}/);
    assert.match(saleSource, /defaultDriverByWeekday=\{routeCatalog\.defaultDriverByWeekday\}/);
  });

  it("creates the delivery task and attaches a selected route", () => {
    assert.match(saleSource, /saleRouteDecisionTask\(quickSaleDraft\.routeDecision\)/);
    assert.match(saleSource, /requestCustomerRouteAssignmentAction\(\{/);
    assert.match(saleSource, /routeTemplateId: quickSaleDraft\.routeDecision\.routeTemplateId/);
    assert.match(saleSource, /requestedRouteDate: quickSaleDraft\.routeDecision\?\.routeDate/);
  });

  it("keeps the box subtotal separate from the deposit configured at payment", () => {
    assert.match(fieldSource, /Total de cajas/);
    assert.match(fieldSource, /Queda debiendo/);
    assert.match(modalSource, /Continuar a pago/);
    assert.match(modalSource, /SaleDepositChargeField/);
    assert.match(fieldSource, /Pago completo/);
    assert.doesNotMatch(modalSource, /Depósito requerido|Depósito a cobrar|Cobrar depósito/);
    assert.match(checkoutSource, /Venta rápida de caja vacía/);
    assert.doesNotMatch(checkoutSource, /Depósito de caja vacía/);
    assert.match(
      saleSource,
      /setQuickPaymentMethod\(draft\.depositPaid \? defaultSalePaymentSelection\(\) : "pending"\)/,
    );
    assert.match(saleSource, /setQuickPayNowDraft\(draft\.payNowAmount\)/);
    assert.match(saleSource, /minimumDeposit=\{logisticsFees\.minimumDeposit\}/);
    assert.doesNotMatch(
      checkoutSource,
      /onPaymentMethodChange\(defaultSalePaymentSelection\(\)\)/,
    );
    assert.match(
      saleSource,
      /computeInvoiceBilling\(\{[\s\S]{0,500}boxCount: quickSaleDraft\.boxCount/,
    );
  });

  it("asks whether to hand over now or schedule a route", () => {
    assert.match(modalSource, /¿Cómo se entrega la caja vacía\?/);
    assert.match(modalSource, /Entregar ahora/);
    assert.match(modalSource, /Programar ruta/);
    assert.match(modalSource, /onRequestRoute/);
    assert.doesNotMatch(modalSource, /Recoge en oficina/);
  });

  it("loads boxes from the configured catalog instead of requiring USA", () => {
    assert.match(saleSource, /listQuickSaleCountries\(countryBoxes\)/);
    assert.match(
      saleSource,
      /resolveQuickSaleBoxCatalog\(countryBoxes, quickSaleCountry\)/,
    );
    assert.match(saleSource, /SaleQuickCountryPicker/);
    assert.match(saleSource, /startQuickEmptyBox/);
    assert.match(
      saleSource,
      /createShipmentAction\(\{[\s\S]{0,500}country: quickSaleDraft\.country/,
    );
    assert.match(
      saleSource,
      /const typedClientAddress = formatValidatedAddress\([\s\S]{0,300}country: "USA"/,
    );
    assert.match(saleSource, /quickSaleDraft\.country, quickSaleDraft\.box/);
    assert.doesNotMatch(saleSource, /resolveCountryBoxes\(countryBoxes, "USA"\)/);
    assert.match(catalogSource, /export function listQuickSaleCountries/);
    assert.match(modalSource, /No hay cajas con precio/);
  });
});
