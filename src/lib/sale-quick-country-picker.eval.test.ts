import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const pickerSource = readFileSync(
  join(root, "src/components/sale/sale-quick-country-picker.tsx"),
  "utf8",
);
const saleSource = readFileSync(join(root, "src/components/venta-client.tsx"), "utf8");
const catalogSource = readFileSync(join(root, "src/lib/sale-quick-box-catalog.ts"), "utf8");

describe("quick sale country picker", () => {
  it("asks which country before opening the empty-box modal", () => {
    assert.match(pickerSource, /¿A qué país\?/);
    assert.match(pickerSource, /Elige el catálogo de cajas vacías/);
    assert.match(pickerSource, /CountryFlag/);
    assert.match(saleSource, /SaleQuickCountryPicker/);
    assert.match(saleSource, /startQuickEmptyBox/);
    assert.match(saleSource, /setQuickSaleCountryPickerOpen\(true\)/);
    assert.match(saleSource, /onQuickEmptyBox=\{startQuickEmptyBox\}/);
  });

  it("resolves boxes for the country the seller picks", () => {
    assert.match(catalogSource, /export function listQuickSaleCountries/);
    assert.match(
      saleSource,
      /resolveQuickSaleBoxCatalog\(countryBoxes, quickSaleCountry\)/,
    );
    assert.match(saleSource, /setQuickSaleCountry\(country\)/);
    assert.doesNotMatch(saleSource, /resolveQuickSaleBoxCatalog\(countryBoxes\)\s*,/);
  });
});
