import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CUSTOMERS_IMPORT_COLUMNS,
  CUSTOMERS_IMPORT_SHEET_DATA,
  CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS,
} from "./customers-import-schema";
import { buildCustomersImportXlsx } from "./customers-import-template";

const root = process.cwd();
const actionSource = readFileSync(join(root, "src", "app", "actions", "customers-import.ts"), "utf8");
const panelSource = readFileSync(
  join(root, "src", "components", "config", "customers-import-panel.tsx"),
  "utf8",
);
const managementSource = readFileSync(
  join(root, "src", "components", "config", "organization-management-panel.tsx"),
  "utf8",
);

describe("customers import eval", () => {
  it("wires Importar tab into organization management", () => {
    assert.match(managementSource, /label: "Importar"/);
    assert.match(managementSource, /"import"/);
    assert.match(managementSource, /CustomersImportPanel/);
  });

  it("guards import actions with canAccessCustomersSession and resolves pricing countries by name", () => {
    assert.match(actionSource, /canAccessCustomersSession/);
    assert.match(actionSource, /pricing_countries/);
    assert.match(actionSource, /importCustomersFromRowsAction/);
    assert.match(actionSource, /previewCustomersImportAction/);
    assert.match(actionSource, /downloadCustomersImportTemplateAction/);
    assert.match(actionSource, /customer\.import/);
  });

  it("panel exposes download, upload preview and confirm import without manual clave", () => {
    assert.match(panelSource, /Descargar plantilla/);
    assert.match(panelSource, /Subir Excel/);
    assert.match(panelSource, /Importar .* válidos/);
    assert.match(panelSource, /previewCustomersImportAction/);
    assert.match(panelSource, /importCustomersFromRowsAction/);
    assert.doesNotMatch(panelSource, /remitente_clave/);
  });

  it("template workbook keeps Datos/Instrucciones sheets and full column contract", async () => {
    const buffer = await buildCustomersImportXlsx();
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    assert.ok(workbook.getWorksheet(CUSTOMERS_IMPORT_SHEET_DATA));
    assert.ok(workbook.getWorksheet(CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS));
    const headers: string[] = [];
    workbook.getWorksheet(CUSTOMERS_IMPORT_SHEET_DATA)!.getRow(1).eachCell((cell) => {
      headers.push(String(cell.value));
    });
    for (const column of CUSTOMERS_IMPORT_COLUMNS) {
      assert.ok(headers.includes(column), `missing ${column}`);
    }
  });
});
