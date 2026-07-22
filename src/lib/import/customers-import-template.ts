import ExcelJS from "exceljs";
import {
  CUSTOMERS_IMPORT_COLUMNS,
  CUSTOMERS_IMPORT_SHEET_DATA,
  CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS,
  CUSTOMERS_IMPORT_MAX_ROWS,
  REMITENTE_COLUMNS,
  type CustomersImportColumn,
} from "@/lib/import/customers-import-schema";

const REMITENTE_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF34D399" },
};

const DESTINATARIO_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFBBF24" },
};

const EXAMPLE_ROWS: Array<Record<CustomersImportColumn, string>> = [
  {
    rem_nombre: "Maria",
    rem_apellido: "Gonzalez",
    rem_telefono: "+1-661-255-4821",
    rem_email: "maria.gonzalez@gmail.com",
    rem_calle: "Valencia Blvd",
    rem_numero: "24516",
    rem_colonia: "Valencia",
    rem_ciudad: "Santa Clarita",
    rem_estado: "CA",
    rem_cp: "91355",
    rem_pais: "USA",
    rem_referencia: "",
    dest_nombre: "Juan",
    dest_apellido: "Perez",
    dest_telefono: "+52-33-1234-5678",
    dest_pais: "Mexico",
    dest_email: "",
    dest_calle: "Av. Juarez",
    dest_numero: "120",
    dest_colonia: "Centro",
    dest_ciudad: "Guadalajara",
    dest_estado: "Jalisco",
    dest_cp: "44100",
    dest_referencia: "Casa azul",
  },
  {
    rem_nombre: "Maria",
    rem_apellido: "Gonzalez",
    rem_telefono: "+1-661-255-4821",
    rem_email: "maria.gonzalez@gmail.com",
    rem_calle: "Valencia Blvd",
    rem_numero: "24516",
    rem_colonia: "Valencia",
    rem_ciudad: "Santa Clarita",
    rem_estado: "CA",
    rem_cp: "91355",
    rem_pais: "USA",
    rem_referencia: "",
    dest_nombre: "Ana",
    dest_apellido: "Lopez",
    dest_telefono: "+52-33-8765-4321",
    dest_pais: "Mexico",
    dest_email: "",
    dest_calle: "Calle Morelos",
    dest_numero: "45",
    dest_colonia: "Americana",
    dest_ciudad: "Guadalajara",
    dest_estado: "Jalisco",
    dest_cp: "44160",
    dest_referencia: "",
  },
];

const INSTRUCTION_LINES = [
  "Plantilla de importación — Remitentes y destinatarios",
  "",
  "1. Llena la hoja Datos. No renombres las columnas ni las hojas.",
  "2. Izquierda (verde) = remitente. Derecha (ámbar) = destinatario.",
  "3. No inventes claves: el sistema agrupa solo. Si repites el mismo rem_nombre + rem_apellido + rem_telefono, es el mismo remitente con varios destinatarios.",
  "4. Obligatorios del remitente: rem_nombre, rem_apellido, rem_telefono.",
  "5. Si dejas el bloque destinatario vacío, se crea solo el remitente.",
  "6. Si llenas destinatario, son obligatorios: dest_nombre, dest_apellido, dest_telefono, dest_pais.",
  "7. dest_pais debe coincidir EXACTAMENTE con un país ya creado en Configuración → Países y precios (ej. Mexico).",
  "8. Máximo " + CUSTOMERS_IMPORT_MAX_ROWS + " filas de datos por archivo.",
  "9. Borra las filas de ejemplo antes de importar tu información real (o reemplázalas).",
  "10. Guarda como .xlsx y súbelo desde Configuración → Organización → Importar.",
];

function styleHeaderCell(cell: ExcelJS.Cell, fill: ExcelJS.Fill) {
  cell.fill = fill;
  cell.font = { bold: true, color: { argb: "FF0F172A" }, size: 11 };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };
}

export async function buildCustomersImportXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Boxario";
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet(CUSTOMERS_IMPORT_SHEET_DATA, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  dataSheet.addRow([...CUSTOMERS_IMPORT_COLUMNS]);
  const headerRow = dataSheet.getRow(1);
  headerRow.height = 28;

  CUSTOMERS_IMPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    const isRemitente = (REMITENTE_COLUMNS as readonly string[]).includes(column);
    styleHeaderCell(cell, isRemitente ? REMITENTE_HEADER_FILL : DESTINATARIO_HEADER_FILL);
  });

  for (const example of EXAMPLE_ROWS) {
    dataSheet.addRow(CUSTOMERS_IMPORT_COLUMNS.map((column) => example[column]));
  }

  CUSTOMERS_IMPORT_COLUMNS.forEach((column, index) => {
    const width = column.includes("email")
      ? 28
      : column.includes("referencia")
        ? 22
        : column.includes("calle")
          ? 20
          : column.includes("telefono")
            ? 18
            : 14;
    dataSheet.getColumn(index + 1).width = width;
  });

  const remitentEnd = REMITENTE_COLUMNS.length;
  dataSheet.getColumn(remitentEnd).border = {
    right: { style: "medium", color: { argb: "FF000000" } },
  };

  const instructions = workbook.addWorksheet(CUSTOMERS_IMPORT_SHEET_INSTRUCTIONS);
  instructions.getColumn(1).width = 110;
  for (const line of INSTRUCTION_LINES) {
    const row = instructions.addRow([line]);
    row.getCell(1).font = line.startsWith("Plantilla")
      ? { bold: true, size: 14, color: { argb: "FF34D399" } }
      : { size: 11, color: { argb: "FFF8FAFC" } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
