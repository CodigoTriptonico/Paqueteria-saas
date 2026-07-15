import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invoiceQrValue } from "./invoice-qr";

describe("invoiceQrValue", () => {
  it("builds public tracking url when origin is provided", () => {
    assert.equal(
      invoiceQrValue("INV-000042", "https://app.example.com"),
      "https://app.example.com/rastrear?codigo=INV-000042",
    );
  });

  it("falls back to invoice number without origin", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    try {
      assert.equal(invoiceQrValue("INV-000042"), "INV-000042");
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previous;
      }
    }
  });
});
