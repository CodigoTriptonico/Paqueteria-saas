import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const validateAddressSource = readFileSync(
  join(root, "src", "app", "api", "validate-address", "route.ts"),
  "utf8",
);
const authSource = readFileSync(join(root, "src", "app", "actions", "auth.ts"), "utf8");
const proxySource = readFileSync(join(root, "src", "proxy.ts"), "utf8");
const signInRouteSource = readFileSync(
  join(root, "src", "app", "api", "auth", "sign-in", "route.ts"),
  "utf8",
);
const usersSource = readFileSync(join(root, "src", "app", "actions", "users.ts"), "utf8");
const inventorySource = readFileSync(join(root, "src", "app", "actions", "inventory.ts"), "utf8");
const shipmentsSource = readFileSync(join(root, "src", "app", "actions", "shipments.ts"), "utf8");
const pricingSource = readFileSync(join(root, "src", "app", "actions", "pricing.ts"), "utf8");

describe("phase 1 security wiring", () => {
  it("validate-address requires session", () => {
    assert.match(validateAddressSource, /getAppSession\(\)/);
    assert.match(validateAddressSource, /status: 401/);
  });

  it("signup is gated by isPublicSignupEnabled", () => {
    assert.match(authSource, /isPublicSignupEnabled/);
    assert.doesNotMatch(authSource, /grant_platform_admin/);
  });

  it("proxy fails closed without supabase env", () => {
    assert.match(proxySource, /Servicio no configurado/);
    assert.doesNotMatch(proxySource, /if \(!url \|\| !key\) \{\s*return NextResponse\.next\(\)/);
  });
});

describe("production security wiring", () => {
  it("validate-address rate limits and hides googleStatus", () => {
    assert.match(validateAddressSource, /enforceValidateAddressRateLimit/);
    assert.doesNotMatch(validateAddressSource, /googleStatus/);
  });

  it("login uses generic credentials message and rate limit", () => {
    assert.match(signInRouteSource, /Credenciales invalidas/);
    assert.match(signInRouteSource, /enforceLoginRateLimit/);
    assert.match(authSource, /Credenciales invalidas/);
    assert.match(authSource, /enforceLoginRateLimit/);
  });

  it("invite user rolls back auth user on profile failure", () => {
    assert.match(usersSource, /deleteAuthUserSafely/);
    assert.match(usersSource, /assertSameOrgWarehouseIds/);
  });

  it("inventory actions call atomic rpc", () => {
    assert.match(inventorySource, /recordInventoryMovementAtomic/);
    assert.match(shipmentsSource, /recordInventoryMovementAtomic/);
  });

  it("pricing save uses replace_pricing_config rpc", () => {
    assert.match(pricingSource, /replace_pricing_config/);
    assert.match(pricingSource, /buildPricingRpcPayload/);
  });
});
