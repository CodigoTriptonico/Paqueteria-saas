import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomersImportGroups,
  CUSTOMERS_IMPORT_COLUMNS,
  CUSTOMERS_IMPORT_MAX_ROWS,
  emptyCustomersImportRow,
  hasRecipientSideData,
  validateCustomersImportRow,
  type CustomersImportRawRow,
} from "./customers-import-schema";

function row(partial: Partial<CustomersImportRawRow>): CustomersImportRawRow {
  return { ...emptyCustomersImportRow(), ...partial };
}

describe("customers import schema", () => {
  it("keeps remitente and destinatario columns in fixed order", () => {
    assert.equal(CUSTOMERS_IMPORT_COLUMNS[0], "remitente_clave");
    assert.ok(CUSTOMERS_IMPORT_COLUMNS.includes("rem_telefono"));
    assert.ok(CUSTOMERS_IMPORT_COLUMNS.includes("dest_pais"));
    assert.equal(CUSTOMERS_IMPORT_MAX_ROWS, 500);
  });

  it("validates required remitent fields", () => {
    const errors = validateCustomersImportRow(row({ rem_nombre: "Ana" }), 2);
    assert.ok(errors.some((error) => /remitente_clave/.test(error.message)));
    assert.ok(errors.some((error) => /rem_apellido/.test(error.message)));
    assert.ok(errors.some((error) => /rem_telefono/.test(error.message)));
  });

  it("requires full destinatario when any dest field is present", () => {
    const errors = validateCustomersImportRow(
      row({
        remitente_clave: "R1",
        rem_nombre: "Ana",
        rem_apellido: "Lopez",
        rem_telefono: "123",
        dest_nombre: "Juan",
      }),
      3,
    );
    assert.ok(errors.some((error) => /dest_apellido/.test(error.message)));
    assert.ok(errors.some((error) => /dest_telefono/.test(error.message)));
    assert.ok(errors.some((error) => /dest_pais/.test(error.message)));
  });

  it("allows remitent-only rows", () => {
    const values = row({
      remitente_clave: "R1",
      rem_nombre: "Ana",
      rem_apellido: "Lopez",
      rem_telefono: "123",
    });
    assert.equal(hasRecipientSideData(values), false);
    assert.equal(validateCustomersImportRow(values, 2).length, 0);
  });

  it("groups same remitente_clave into one sender with many recipients", () => {
    const result = buildCustomersImportGroups([
      {
        rowNumber: 2,
        values: row({
          remitente_clave: "R001",
          rem_nombre: "Maria",
          rem_apellido: "Gonzalez",
          rem_telefono: "111",
          dest_nombre: "Juan",
          dest_apellido: "Perez",
          dest_telefono: "222",
          dest_pais: "Mexico",
        }),
      },
      {
        rowNumber: 3,
        values: row({
          remitente_clave: "R001",
          rem_nombre: "Maria",
          rem_apellido: "Gonzalez",
          rem_telefono: "111",
          dest_nombre: "Ana",
          dest_apellido: "Lopez",
          dest_telefono: "333",
          dest_pais: "Mexico",
        }),
      },
      {
        rowNumber: 4,
        values: row({
          remitente_clave: "R002",
          rem_nombre: "Carlos",
          rem_apellido: "Ramirez",
          rem_telefono: "444",
        }),
      },
    ]);

    assert.equal(result.rowErrors.length, 0);
    assert.equal(result.validSenderCount, 2);
    assert.equal(result.validRecipientCount, 2);
    assert.equal(result.groups[0]?.recipients.length, 2);
    assert.equal(result.groups[1]?.recipients.length, 0);
  });

  it("rejects incomplete destinatario rows without creating a group entry for that row", () => {
    const result = buildCustomersImportGroups([
      {
        rowNumber: 2,
        values: row({
          remitente_clave: "R001",
          rem_nombre: "Maria",
          rem_apellido: "Gonzalez",
          rem_telefono: "111",
          dest_nombre: "Juan",
        }),
      },
    ]);
    assert.equal(result.groups.length, 0);
    assert.ok(result.rowErrors.length >= 1);
  });
});
