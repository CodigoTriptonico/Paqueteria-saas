import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppSessionFromProfile,
  extractPermissionKeys,
  type ProfileSessionInput,
} from "@/lib/auth/session-build";

const baseProfile: ProfileSessionInput = {
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
  isPlatformAdmin: true,
};

describe("extractPermissionKeys", () => {
  it("flattens nested permission rows", () => {
    assert.deepEqual(
      extractPermissionKeys([
        { permissions: { key: "sales.manage" } },
        { permissions: [{ key: "customers.manage" }] },
        { permissions: null },
      ]),
      ["sales.manage", "customers.manage"],
    );
  });
});

describe("buildAppSessionFromProfile", () => {
  it("keeps the profile organization as the only data scope", () => {
    const session = buildAppSessionFromProfile(baseProfile);
    assert.equal(session.userId, "user-1");
    assert.equal(session.organizationId, "org-home");
    assert.equal(session.organizationName, "Home Org");
    assert.equal(session.roleSlug, "administrador");
    assert.deepEqual(session.warehouseIds, ["wh-1"]);
  });
});
