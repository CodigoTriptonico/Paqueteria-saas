import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const shipmentsActionsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/shipments.ts"),
  "utf8",
);

describe("logistica invoice loading eval", () => {
  it("does not hide missing shipment columns as zero invoices", () => {
    assert.equal(shipmentsActionsSource.includes('error.code === "42P01"'), true);
    assert.equal(shipmentsActionsSource.includes('error.code === "42703"'), false);
    assert.equal(shipmentsActionsSource.includes("return fail(error.message);"), true);
  });
});
