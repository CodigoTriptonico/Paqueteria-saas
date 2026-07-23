import assert from "node:assert/strict";
import test from "node:test";
import { recipientExcelQrValue } from "./recipient-qr";

test("recipient QR produces spreadsheet-ready columns and sanitizes embedded tabs", () => {
  const value = recipientExcelQrValue({
    id: "recipient-1",
    firstName: "Ana",
    lastName: "López",
    country: "México",
    phone: "555-0101",
    email: "ana@example.com",
    emails: ["ana@example.com"],
    street: "Av. Reforma",
    houseNumber: "10",
    neighborhood: "Centro",
    city: "Puebla",
    state: "Puebla",
    postalCode: "72000",
    addressReference: "Portón\tazul",
    cardStyle: "",
    placeId: "",
    formattedAddress: "",
    addressVerified: true,
    lat: null,
    lng: null,
  });

  const [headers, row] = value.split("\n");
  assert.equal(headers?.split("\t").length, 11);
  assert.equal(row?.split("\t").length, 11);
  assert.match(value, /NOMBRE_DESTINATARIO\tTELEFONO\tCORREO/);
  assert.match(value, /Ana López\t555-0101\tana@example\.com/);
  assert.match(value, /Portón azul$/);
});
