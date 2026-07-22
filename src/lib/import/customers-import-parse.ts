import ExcelJS from "exceljs";
import {
  buildCustomersImportGroups,
  CUSTOMERS_IMPORT_COLUMNS,
  CUSTOMERS_IMPORT_SHEET_DATA,
  emptyCustomersImportRow,
  normalizeImportCell,
  type CustomersImportColumn,
  type CustomersImportParseResult,
  type CustomersImportRawRow,
} from "@/lib/import/customers-import-schema";

function headerIndexMap(headerRow: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeImportCell(cell.value).toLowerCase();
    if (key) {
      map.set(key, colNumber);
    }
  });
  return map;
}

function readRowValues(
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
): CustomersImportRawRow {
  const values = emptyCustomersImportRow();
  for (const column of CUSTOMERS_IMPORT_COLUMNS) {
    const colNumber = headerMap.get(column);
    if (!colNumber) {
      continue;
    }
    values[column] = normalizeImportCell(row.getCell(colNumber).value);
  }
  return values;
}

export async function parseCustomersImportWorkbook(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<CustomersImportParseResult & { headerErrors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  // exceljs accepts Buffer; Uint8Array/ArrayBuffer need wrapping in Node
  const input =
    buffer instanceof ArrayBuffer
      ? Buffer.from(buffer)
      : Buffer.isBuffer(buffer)
        ? buffer
        : Buffer.from(buffer);

  await workbook.xlsx.load(input as never);

  const sheet =
    workbook.getWorksheet(CUSTOMERS_IMPORT_SHEET_DATA) ||
    workbook.worksheets.find((candidate) => candidate.name.trim().toLowerCase() === "datos") ||
    workbook.worksheets[0];

  if (!sheet) {
    return {
      groups: [],
      rowErrors: [{ rowNumber: 0, message: "El archivo no tiene hojas." }],
      headerErrors: ["El archivo no tiene hojas."],
      validSenderCount: 0,
      validRecipientCount: 0,
      totalDataRows: 0,
    };
  }

  const headerRow = sheet.getRow(1);
  const headerMap = headerIndexMap(headerRow);
  const headerErrors: string[] = [];

  for (const column of CUSTOMERS_IMPORT_COLUMNS) {
    if (!headerMap.has(column)) {
      headerErrors.push(`Falta la columna "${column}" en la hoja ${sheet.name}.`);
    }
  }

  if (headerErrors.length) {
    return {
      groups: [],
      rowErrors: headerErrors.map((message) => ({ rowNumber: 1, message })),
      headerErrors,
      validSenderCount: 0,
      validRecipientCount: 0,
      totalDataRows: 0,
    };
  }

  const rows: Array<{ rowNumber: number; values: CustomersImportRawRow }> = [];
  const lastRow = sheet.actualRowCount || sheet.rowCount || 1;

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    rows.push({
      rowNumber,
      values: readRowValues(excelRow, headerMap),
    });
  }

  const parsed = buildCustomersImportGroups(rows);
  return { ...parsed, headerErrors: [] };
}

export function mapObjectRowsToImportResult(
  objects: Array<Partial<Record<CustomersImportColumn, unknown>>>,
): CustomersImportParseResult {
  const rows = objects.map((object, index) => {
    const values = emptyCustomersImportRow();
    for (const column of CUSTOMERS_IMPORT_COLUMNS) {
      values[column] = normalizeImportCell(object[column]);
    }
    return { rowNumber: index + 2, values };
  });
  return buildCustomersImportGroups(rows);
}
