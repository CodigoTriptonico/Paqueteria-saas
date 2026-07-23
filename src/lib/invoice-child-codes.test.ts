import assert from "node:assert/strict";
import test from "node:test";
import {
  invoiceBoxCode,
  invoiceBoxCodes,
  invoiceBoxSuffix,
  printableBoxInvoiceCodes,
} from "./invoice-child-codes";

test("each physical box receives an alphabetic child invoice under its sale invoice", () => {
  assert.equal(invoiceBoxCode("INV-000123", 0), "INV-000123-A");
  assert.equal(invoiceBoxCode("INV-000123", 25), "INV-000123-Z");
  assert.equal(invoiceBoxCode("INV-000123", 26), "INV-000123-AA");
  assert.deepEqual(invoiceBoxCodes("INV-000123", 3), [
    "INV-000123-A",
    "INV-000123-B",
    "INV-000123-C",
  ]);
});

test("invoice suffixes remain deterministic past one alphabet", () => {
  assert.equal(invoiceBoxSuffix(27), "AB");
  assert.equal(invoiceBoxSuffix(701), "ZZ");
  assert.equal(invoiceBoxSuffix(702), "AAA");
});

test("every physical box receives its own printable label", () => {
  assert.deepEqual(printableBoxInvoiceCodes("INV-000006", 0), []);
  assert.deepEqual(printableBoxInvoiceCodes("INV-000006", 1), ["INV-000006-A"]);
  assert.deepEqual(printableBoxInvoiceCodes("INV-000006", 2), ["INV-000006-A", "INV-000006-B"]);
});
