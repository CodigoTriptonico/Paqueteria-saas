import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("security hardening regression gate", () => {
  it("keeps privileged SQL entry points closed and RLS explicit", () => {
    const sql = read("supabase/migrations/128_security_hardening_foundation.sql");
    assert.match(sql, /revoke execute on function public\.grant_platform_admin/);
    assert.match(sql, /revoke execute on function public\.record_shipment_package_invoice_event/);
    assert.match(sql, /alter table public\.agency_route_proposals enable row level security/);
    assert.match(sql, /guard_profile_authorization_fields/);
    assert.match(sql, /guard_agency_request_line_scope/);
  });

  it("derives legacy sale money from server-side catalog data", () => {
    const action = read("src/app/actions/shipments.ts");
    assert.match(action, /authoritativeSaleQuote/);
    assert.match(action, /from\("pricing_countries"\)/);
    assert.match(action, /from\("pricing_promotions"\)/);
    assert.match(action, /const cost = authoritativeQuote\.cost/);
    assert.match(action, /invoiceStatus: InvoiceStatus[\s\S]*paid >= authoritativeQuote\.total/);
    assert.doesNotMatch(action, /const cost = parseMoney\(input\.cost\)/);
  });

  it("creates the legacy sale through one idempotent database command", () => {
    const action = read("src/app/actions/shipments.ts");
    const sql = read(
      "supabase/migrations/132_atomic_sales_tracking_and_authoritative_writes.sql",
    );
    assert.match(action, /create_shipment_sale_atomic/);
    assert.match(action, /randomBytes\(32\)\.toString\("base64url"\)/);
    assert.match(sql, /create or replace function public\.create_shipment_sale_atomic/);
    assert.match(sql, /for update/);
    assert.match(sql, /insert into public\.shipment_payments/);
    assert.match(sql, /insert into public\.inventory_movements/);
    assert.match(sql, /insert into public\.security_audit_events/);
    assert.match(sql, /SHIPMENT_AUTHORITATIVE_COLUMNS_COMMAND_REQUIRED/);
    assert.match(sql, /INVENTORY_MOVEMENT_COMMAND_REQUIRED/);
    assert.match(sql, /revoke insert, update, delete on table public\.shipment_payments/);
  });

  it("verifies migration 132 in the effective release catalog", () => {
    const catalog = read("scripts/security-catalog-check.mjs");
    assert.match(catalog, /missing atomic sale tables/);
    assert.match(catalog, /missing public tracking token columns/);
    assert.match(catalog, /missing authoritative write triggers/);
    assert.match(catalog, /unsafe atomic sale function execution/);
    assert.match(catalog, /non-null-safe authoritative guards/);
    assert.match(catalog, /profile command owner bypass missing/);
    assert.match(catalog, /authenticated direct payment writes/);
  });

  it("lets administrative PostgreSQL sessions run maintenance without weakening app writes", () => {
    const sql = read("supabase/migrations/133_fix_authoritative_guard_null_role.sql");
    assert.equal(
      sql.match(/auth\.role\(\) is distinct from 'authenticated'/g)?.length,
      2,
    );
    assert.match(sql, /SHIPMENT_COMMAND_REQUIRED/);
    assert.match(sql, /INVENTORY_MOVEMENT_COMMAND_REQUIRED/);
  });

  it("lets authorized security-definer commands update profiles without enabling direct escalation", () => {
    const sql = read("supabase/migrations/134_allow_authorized_profile_commands.sql");
    assert.match(sql, /current_user in \('postgres', 'supabase_admin'\)/);
    assert.match(sql, /caller_role = 'service_role'/);
    assert.match(sql, /PROFILE_SELF_AUTHORIZATION_FIELDS_FORBIDDEN/);
    assert.match(sql, /PROFILE_ROLE_SCOPE_MISMATCH/);
  });

  it("requires scoped PIN authentication for the employee clock", () => {
    const action = read("src/app/actions/time-clock.ts");
    assert.match(action, /requireAppSession\(\)/);
    assert.match(action, /\.eq\("organization_id", appSession\.organizationId\)/);
    assert.match(action, /verifyTimeClockPin/);
    assert.match(action, /time_clock_auth_events/);
    assert.match(action, /maxAttempts: 8/);
  });

  it("minimizes public tracking and sanitizes uploaded images", () => {
    const tracking = read("src/lib/public-tracking.ts");
    const route = read("src/app/api/public/tracking/route.ts");
    const conductor = read("src/app/actions/conductor-tasks.ts");
    assert.doesNotMatch(tracking, /payment: \{/);
    assert.doesNotMatch(route, /shipment_payments\(amount/);
    assert.match(route, /public_tracking_token_hash/);
    assert.match(route, /public_tracking_expires_at/);
    assert.doesNotMatch(route, /phoneLastFour/);
    assert.match(conductor, /decodeAndSanitizeImage/);
    assert.match(read("supabase/migrations/131_private_inventory_photos.sql"), /set public = false/);
  });

  it("fails rate limiting closed and budgets independent dimensions", () => {
    const guards = read("src/lib/security/api-guards.ts");
    const requestIp = read("src/lib/security/request-ip.ts");
    assert.match(guards, /throw new Error\("RATE_LIMIT_UNAVAILABLE"\)/);
    assert.match(guards, /LOGIN_RATE_LIMIT\.bucket}_ip/);
    assert.match(guards, /LOGIN_RATE_LIMIT\.bucket}_account/);
    assert.match(guards, /PUBLIC_TRACKING_RATE_LIMIT\.bucket}_ip/);
    assert.match(guards, /PUBLIC_TRACKING_RATE_LIMIT\.bucket}_code/);
    assert.match(requestIp, /TRUST_PROXY_HEADERS === "1"/);
  });

  it("bounds multipart parsing and redacts unexpected failures", () => {
    const route = read("src/app/api/conductor/task-results/route.ts");
    const config = read("next.config.ts");
    assert.ok(route.indexOf("content-length") < route.indexOf("request.formData()"));
    assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
    assert.match(route, /correlationId/);
    assert.match(config, /proxyClientMaxBodySize: "10mb"/);
  });
});
