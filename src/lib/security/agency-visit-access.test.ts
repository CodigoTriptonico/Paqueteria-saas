import assert from "node:assert/strict";
import test from "node:test";
import type { AppSession } from "@/lib/auth/types";
import { canReadDriverAgencyVisits } from "@/lib/security/agency-visit-access";

function session(input: Partial<AppSession>): AppSession {
  return {
    userId: "user-1",
    email: "user@example.test",
    fullName: "Usuario",
    organizationId: "org-1",
    organizationName: "Empresa",
    organizationShortName: null,
    organizationLogoUrl: null,
    agencyModuleEnabled: true,
    multiWarehouseEnabled: false,
    maxWarehouses: 1,
    roleSlug: "vendedor",
    roleName: "Vendedor",
    permissions: [],
    warehouseIds: [],
    preferredWarehouseId: null,
    isPlatformAdmin: false,
    ...input,
  };
}

test("a driver can read only their own agency visits", () => {
  const driver = session({ userId: "driver-1", roleSlug: "conductor" });
  assert.equal(canReadDriverAgencyVisits(driver, "driver-1"), true);
  assert.equal(canReadDriverAgencyVisits(driver, "driver-2"), false);
});

test("non-drivers need the explicit routes.view capability", () => {
  assert.equal(canReadDriverAgencyVisits(session({}), "driver-1"), false);
  assert.equal(
    canReadDriverAgencyVisits(session({ permissions: ["routes.view"] }), "driver-1"),
    true,
  );
});
