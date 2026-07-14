import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPath } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";

function sellerSession(): AppSession {
  return {
    userId: "seller-1",
    email: "seller@test.com",
    fullName: "Seller",
    organizationId: "org-1",
    organizationName: "Org",
    homeOrganizationId: "org-1",
    homeOrganizationName: "Org",
    actingOrganizationId: null,
    actingOrganizationName: null,
    isActingAsClient: false,
    multiWarehouseEnabled: false,
    maxWarehouses: 1,
    roleSlug: "vendedor",
    roleName: "Vendedor",
    permissions: ["sales.manage", "customers.manage", "inventory.view"],
    warehouseIds: [],
    preferredWarehouseId: null,
    isPlatformAdmin: false,
  };
}

function adminSession(): AppSession {
  return {
    userId: "admin-1",
    email: "admin@test.com",
    fullName: "Admin",
    organizationId: "org-1",
    organizationName: "Org",
    homeOrganizationId: "org-1",
    homeOrganizationName: "Org",
    actingOrganizationId: null,
    actingOrganizationName: null,
    isActingAsClient: false,
    multiWarehouseEnabled: false,
    maxWarehouses: 1,
    roleSlug: "administrador",
    roleName: "Administrador",
    permissions: ["all"],
    warehouseIds: [],
    preferredWarehouseId: null,
    isPlatformAdmin: false,
  };
}

function driverSession(): AppSession {
  return {
    userId: "driver-1",
    email: "conductor@test.com",
    fullName: "Conductor Test",
    organizationId: "org-1",
    organizationName: "Org",
    homeOrganizationId: "org-1",
    homeOrganizationName: "Org",
    actingOrganizationId: null,
    actingOrganizationName: null,
    isActingAsClient: false,
    multiWarehouseEnabled: false,
    maxWarehouses: 1,
    roleSlug: "conductor",
    roleName: "Conductor",
    permissions: ["routes.view", "routes.update_status"],
    warehouseIds: [],
    preferredWarehouseId: null,
    isPlatformAdmin: false,
  };
}

describe("canAccessPath seller shipments", () => {
  it("lets sellers open envios", () => {
    assert.equal(canAccessPath(sellerSession(), "/seguimiento"), true);
  });

  it("keeps logistica admin-only", () => {
    assert.equal(canAccessPath(sellerSession(), "/logistica"), false);
  });

  it("keeps estadisticas admin-only", () => {
    assert.equal(canAccessPath(sellerSession(), "/estadisticas"), false);
  });

  it("keeps auditoria admin-only", () => {
    assert.equal(canAccessPath(sellerSession(), "/auditoria"), false);
    assert.equal(canAccessPath(adminSession(), "/auditoria"), true);
  });

  it("keeps legacy vendedores redirect admin-only", () => {
    assert.equal(canAccessPath(sellerSession(), "/vendedores"), false);
  });

  it("lets administrators open warehouse operations", () => {
    assert.equal(canAccessPath(adminSession(), "/ingreso-bodega"), true);
    assert.equal(canAccessPath(adminSession(), "/bodega"), true);
    assert.equal(canAccessPath(adminSession(), "/paletas"), true);
  });
});

describe("canAccessPath conductor tasks", () => {
  it("lets conductors open tareas conductor", () => {
    assert.equal(canAccessPath(driverSession(), "/conductor/tareas"), true);
  });

  it("keeps sellers off conductor tasks", () => {
    assert.equal(canAccessPath(sellerSession(), "/conductor/tareas"), false);
  });

  it("keeps conductors off envios", () => {
    assert.equal(canAccessPath(driverSession(), "/seguimiento"), false);
  });

  it("lets admins preview tareas conductor", () => {
    assert.equal(canAccessPath(adminSession(), "/conductor/tareas"), true);
  });
});
