import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOMERS_IMPORT_COLUMNS,
  CUSTOMERS_IMPORT_SHEET_DATA,
  CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS,
} from "./customers-import-schema";
import { mapObjectRowsToImportResult, parseCustomersImportWorkbook } from "./customers-import-parse";
import { buildCustomersImportXlsx } from "./customers-import-template";

describe("customers import parse + template", () => {
  it("maps plain objects through the same group builder", () => {
    const result = mapObjectRowsToImportResult([
      {
        rem_nombre: "Ana",
        rem_apellido: "Lopez",
        rem_telefono: "123",
        dest_nombre: "Juan",
        dest_apellido: "Perez",
        dest_telefono: "456",
        dest_pais: "Mexico",
      },
    ]);
    assert.equal(result.validSenderCount, 1);
    assert.equal(result.validRecipientCount, 1);
    assert.equal(result.groups[0]?.clave, "R001");
  });

  it("builds a workbook with Datos + Instrucciones and required columns", async () => {
    const buffer = await buildCustomersImportXlsx();
    assert.ok(buffer.byteLength > 1000);

    const parsed = await parseCustomersImportWorkbook(buffer);
    assert.equal(parsed.headerErrors.length, 0);
    assert.equal(parsed.validSenderCount, 1);
    assert.equal(parsed.validRecipientCount, 2);
    assert.equal(parsed.groups[0]?.clave, "R001");
  });

  it("rejects workbooks missing required headers", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(CUSTOMERS_IMPORT_SHEET_DATA);
    sheet.addRow(["rem_nombre", "rem_apellido"]);
    sheet.addRow(["Ana", "Lopez"]);
    workbook.addWorksheet(CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const parsed = await parseCustomersImportWorkbook(Buffer.from(arrayBuffer));
    assert.ok(parsed.headerErrors.length > 0);
    assert.ok(parsed.headerErrors.some((message) => message.includes("rem_telefono")));
  });

  it("exports every contract column in the template header", async () => {
    const buffer = await buildCustomersImportXlsx();
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet(CUSTOMERS_IMPORT_SHEET_DATA);
    assert.ok(sheet);
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value)));
    assert.deepEqual(headers, [...CUSTOMERS_IMPORT_COLUMNS]);
    assert.ok(workbook.getWorksheet(CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS));
  });
});
