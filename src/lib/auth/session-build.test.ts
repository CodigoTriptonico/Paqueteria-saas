import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppSessionFromProfile,
  extractPermissionKeys,
  PLATFORM_VIEW_PERMISSIONS,
  resolveActingContext,
  type ProfileSessionInput,
} from "@/lib/auth/session-build";

const baseHome: ProfileSessionInput = {
  userId: "user-1",
  email: "admin@test.com",
  fullName: "Admin",
  organizationId: "org-home",
  defaultWarehouseId: "wh-1",
  roleSlug: "administrador",
  roleName: "Administrador",
  homeOrganizationName: "Home Org",
  homeOrganizationSettings: { multi_warehouse_enabled: true },
  permissions: ["sales.manage"],
  warehouseIds: ["wh-1"],
  isPlatformAdmin: false,
};

describe("extractPermissionKeys", () => {
  it("flattens nested permission rows", () => {
    const keys = extractPermissionKeys([
      { permissions: { key: "sales.manage" } },
      { permissions: [{ key: "customers.manage" }] },
      { permissions: null },
    ]);

    assert.deepEqual(keys, ["sales.manage", "customers.manage"]);
  });
});

describe("resolveActingContext", () => {
  it("returns home context when not acting as client", () => {
    const result = resolveActingContext({
      isPlatformAdmin: true,
      onPlatformRoute: false,
      actAsOrganizationId: null,
      actingOrg: null,
      home: baseHome,
    });

    assert.equal(result.organizationId, "org-home");
    assert.equal(result.isActingAsClient, false);
    assert.equal(result.preferredWarehouseId, "wh-1");
  });

  it("switches to acting org for platform admin with act-as cookie", () => {
    const result = resolveActingContext({
      isPlatformAdmin: true,
      onPlatformRoute: false,
      actAsOrganizationId: "org-client",
      actingOrg: {
        id: "org-client",
        name: "Client Org",
        settings: { multi_warehouse_enabled: false },
      },
      home: { ...baseHome, isPlatformAdmin: true },
    });

    assert.equal(result.organizationId, "org-client");
    assert.equal(result.organizationName, "Client Org");
    assert.equal(result.isActingAsClient, true);
    assert.deepEqual(result.permissions, PLATFORM_VIEW_PERMISSIONS);
    assert.deepEqual(result.warehouseIds, []);
    assert.equal(result.preferredWarehouseId, null);
  });

  it("ignores act-as on platform route", () => {
    const result = resolveActingContext({
      isPlatformAdmin: true,
      onPlatformRoute: true,
      actAsOrganizationId: "org-client",
      actingOrg: {
        id: "org-client",
        name: "Client Org",
        settings: null,
      },
      home: { ...baseHome, isPlatformAdmin: true },
    });

    assert.equal(result.organizationId, "org-home");
    assert.equal(result.isActingAsClient, false);
  });
});

describe("buildAppSessionFromProfile", () => {
  it("merges home profile with resolved acting context", () => {
    const acting = resolveActingContext({
      isPlatformAdmin: false,
      onPlatformRoute: false,
      actAsOrganizationId: null,
      actingOrg: null,
      home: baseHome,
    });

    const session = buildAppSessionFromProfile(baseHome, acting);

    assert.equal(session.userId, "user-1");
    assert.equal(session.homeOrganizationId, "org-home");
    assert.equal(session.organizationId, "org-home");
    assert.equal(session.roleSlug, "administrador");
  });
});
