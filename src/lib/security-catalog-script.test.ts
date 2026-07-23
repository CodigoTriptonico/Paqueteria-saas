import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(
  join(process.cwd(), "scripts/security-catalog-check.mjs"),
  "utf8",
);

describe("security catalog release gate", () => {
  it("checks every migration 132 enforcement boundary in the effective catalog", () => {
    assert.match(source, /shipment_sale_operations/);
    assert.match(source, /security_audit_events/);
    assert.match(source, /public_tracking_token_hash/);
    assert.match(source, /shipments_authoritative_write_guard/);
    assert.match(source, /inventory_stock_direct_write_guard/);
    assert.match(source, /create_shipment_sale_atomic/);
    assert.match(source, /non-null-safe authoritative guards/);
    assert.match(source, /profile command owner bypass missing/);
    assert.match(source, /authenticated direct payment writes/);
  });
});
