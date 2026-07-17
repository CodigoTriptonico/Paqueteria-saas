import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/073_business_integration_reporting.sql"), "utf8");

describe("business integration schema", () => {
  it("creates role templates without collapsing permission scopes", () => {
    for (const role of ["supervisor_agencias", "captador_agencias", "finanzas", "logistica", "bodega", "administrador_agencia", "vendedor_agencia", "caja_agencia", "operador_agencia", "auditor"]) {
      assert.match(sql, new RegExp(`'${role}'`));
    }
    assert.match(sql, /financial_hold\.release_manual/);
    assert.doesNotMatch(sql, /\('bodega', 'financial_hold\.release'/);
  });

  it("synchronizes membership history and archives instead of deleting", () => {
    assert.match(sql, /sync_profile_business_membership/);
    assert.match(sql, /status = 'ended'/);
    assert.match(sql, /archive_business_organization/);
    assert.doesNotMatch(sql, /delete from public\.(organizations|profiles|organization_memberships)/i);
  });

  it("builds the UI snapshot from authenticated scope", () => {
    assert.match(sql, /auth\.uid\(\) is null/);
    assert.match(sql, /tenant_organization_access/);
    assert.match(sql, /load_business_workspace/);
    assert.doesNotMatch(sql, /target_tenant_id/);
  });

  it("bridges agency sale box sources to deterministic FIFO allocation", () => {
    assert.match(sql, /sync_agency_sale_box_source/);
    assert.match(sql, /agency_shipment_box_sources/);
    assert.match(sql, /agency_allocate_boxes_fifo/);
    assert.match(sql, /MATRIX_BOX_DETAILS_REQUIRED/);
  });
});
