import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/094_commercial_configuration_inheritance.sql"), "utf8");
const intervalSql = readFileSync(join(process.cwd(), "supabase/migrations/096_commercial_override_half_open_intervals.sql"), "utf8");
const requestScopeSql = readFileSync(join(process.cwd(), "supabase/migrations/097_agency_request_scope_guard.sql"), "utf8");
const resolverAuthorizationSql = readFileSync(join(process.cwd(), "supabase/migrations/098_commercial_price_resolver_authorization.sql"), "utf8");
const minimumPriceSql = readFileSync(join(process.cwd(), "supabase/migrations/099_commercial_minimum_price_guard.sql"), "utf8");

describe("commercial configuration schema", () => {
  it("uses half-open intervals so same-transaction restore is safe", () => {
    assert.match(intervalSql, /valid_until >= valid_from/);
    assert.match(intervalSql, /Half-open interval/);
  });

  it("keeps one central entity > group > country resolver", () => {
    assert.match(sql, /create or replace function public\.resolve_commercial_price/);
    assert.ok(sql.indexOf("entity_override.id is not null") < sql.indexOf("group_override.id is not null"));
    assert.match(sql, /COUNTRY_COMMERCIAL_BASE_NOT_CONFIGURED/);
  });

  it("supports the same temporal override contract for sellers and agencies", () => {
    assert.match(sql, /audience in \('agency', 'seller'\)/);
    assert.match(sql, /valid_from timestamptz/);
    assert.match(sql, /valid_until timestamptz/);
    assert.match(sql, /commercial_pricing_overrides_active_uidx/);
  });

  it("snapshots domicile and sale prices instead of trusting the frontend", () => {
    assert.match(sql, /commercial_price_snapshot/);
    assert.match(sql, /public\.resolve_commercial_price\(\s*'agency'/);
    assert.match(sql, /rate_snapshot/);
    assert.match(sql, /'snapshottedAt',now\(\)/);
    assert.doesNotMatch(sql, /unitChargeAmountCents/);
  });

  it("keeps customer money, matrix receivable and public price separate", () => {
    assert.match(sql, /'customerTotalCents',total_value/);
    assert.match(sql, /'matrixReceivableCents',internal_total/);
    assert.match(sql, /insert into public\.agency_charges/);
    assert.doesNotMatch(sql, /insert into public\.customer_payments/);
  });

  it("requires five explicit agency logistics services and customer addresses", () => {
    for (const service of ["agency_office_empty_box_delivery", "agency_office_full_box_pickup", "customer_home_delivery", "customer_empty_box_delivery", "customer_full_box_pickup"]) assert.match(sql, new RegExp(service));
    assert.match(sql, /AGENCY_CUSTOMER_ADDRESS_REQUIRED/);
    assert.match(sql, /agency_box_custody_events/);
    assert.match(requestScopeSql, /REQUEST_SCOPE_MIXED/);
    assert.match(requestScopeSql, /before insert or update of request_id, service_code/);
  });

  it("preserves route history and quantity-difference guards", () => {
    assert.match(sql, /update public\.agency_default_route_assignments set ended_at=now\(\)/);
    assert.match(sql, /'historyPreserved', true/);
    const operations = readFileSync(join(process.cwd(), "supabase/migrations/072_agency_operations.sql"), "utf8");
    assert.match(operations, /Toda diferencia requiere motivo/);
    assert.match(operations, /inventory_stock set stock = stock - confirmed_value/);
  });

  it("blocks mutations without a dedicated commercial permission", () => {
    assert.match(sql, /commercial\.settings\.manage/);
    assert.match(sql, /raise exception 'FORBIDDEN'/);
  });

  it("does not expose another entity's effective prices through the definer RPC", () => {
    assert.match(resolverAuthorizationSql, /entity_organization_value = public\.current_business_organization_id\(\)/);
    assert.match(resolverAuthorizationSql, /target_entity_id = auth\.uid\(\)/);
    assert.match(resolverAuthorizationSql, /commercial\.settings\.view/);
    assert.match(resolverAuthorizationSql, /then raise exception 'FORBIDDEN'/);
  });

  it("keeps seller minimum prices below the configured public price without rewriting history", () => {
    assert.match(minimumPriceSql, /minimum_amount_cents <= amount_cents/);
    assert.match(minimumPriceSql, /not valid/);
  });
});
