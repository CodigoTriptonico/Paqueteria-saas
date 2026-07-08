import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "047_production_security_hardening.sql",
);
const migrationSource = readFileSync(migrationPath, "utf8");
const orgScopeSource = readFileSync(
  join(root, "src", "lib", "security", "org-scope.ts"),
  "utf8",
);

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function public.${functionName}(`);
  assert.notEqual(start, -1, `missing function ${functionName}`);
  const bodyStart = source.indexOf("begin", start);
  const end = source.indexOf("\nend;\n$$", bodyStart);
  assert.notEqual(bodyStart, -1, `missing body for ${functionName}`);
  assert.notEqual(end, -1, `missing end for ${functionName}`);
  return source.slice(bodyStart, end);
}

describe("047 production security hardening migration", () => {
  it("inventory movements qty must be positive without deleting audit rows", () => {
    assert.match(migrationSource, /inventory_movements_qty_positive/);
    assert.match(migrationSource, /check \(qty > 0\)/);
    assert.doesNotMatch(migrationSource, /delete from public\.inventory_movements/i);
    assert.match(migrationSource, /Migracion abortada: % movimientos con qty invalida/);
  });

  it("record_inventory_movement_atomic locks stock rows and enforces org + permissions", () => {
    const body = extractFunctionBody(migrationSource, "record_inventory_movement_atomic");
    assert.match(body, /for update/i);
    assert.match(body, /target_org_id is distinct from public\.current_organization_id\(\)/);
    assert.match(body, /auth\.role\(\) <> 'service_role'/);
    assert.match(body, /user_has_permission\('inventory\.adjust'\)/);
    assert.match(body, /user_has_permission\('inventory\.reserve'\)/);
  });

  it("replace_pricing_config validates before destructive writes and enforces org + settings.manage", () => {
    const body = extractFunctionBody(migrationSource, "replace_pricing_config");
    assert.match(body, /Validate countries/i);
    assert.match(body, /delete from public\.pricing_countries where organization_id = target_org_id/);
    assert.match(body, /target_org_id is distinct from public\.current_organization_id\(\)/);
    assert.match(body, /user_has_permission\('settings\.manage'\)/);
  });

  it("consume_rate_limit is service_role only", () => {
    const body = extractFunctionBody(migrationSource, "consume_rate_limit");
    assert.match(body, /auth\.role\(\) <> 'service_role'/);
    assert.match(
      migrationSource,
      /revoke execute on function public\.consume_rate_limit\(text, text, int, int\) from public, authenticated;/,
    );
    assert.match(
      migrationSource,
      /grant execute on function public\.consume_rate_limit\(text, text, int, int\) to service_role;/,
    );
    assert.doesNotMatch(
      migrationSource,
      /grant execute on function public\.consume_rate_limit\(text, text, int, int\) to authenticated/i,
    );
  });

  it("shipments org created_at index exists", () => {
    assert.match(migrationSource, /idx_shipments_org_created_at/);
  });
});

describe("org-scope recipient table", () => {
  it("assertSameOrgRecipientIds uses customer_recipients", () => {
    assert.match(orgScopeSource, /"customer_recipients"/);
    assert.doesNotMatch(orgScopeSource, /"recipients"/);
  });
});
