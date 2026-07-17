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

function distributorSession(): AppSession {
  return {
    ...sellerSession(),
    userId: "distributor-1",
    roleSlug: "distribuidor",
    roleName: "Distribuidor",
    permissions: ["distribution.sell"],
  };
}

function captorSession(): AppSession {
  return {
    ...sellerSession(),
    userId: "captor-1",
    roleSlug: "captador_distribuidores",
    roleName: "Captador de distribuidores",
    permissions: ["distribution.acquire"],
  };
}

function businessRoleSession(
  roleSlug: string,
  permissions: AppSession["permissions"],
): AppSession {
  return {
    ...sellerSession(),
    userId: `${roleSlug}-1`,
    roleSlug,
    roleName: roleSlug,
    permissions,
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

describe("canAccessPath platform account", () => {
  it("only allows the platform console and never client operations", () => {
    const platform = {
      ...adminSession(),
      isPlatformAdmin: true,
      organizationId: "platform-org",
    };

    assert.equal(canAccessPath(platform, "/platform"), true);
    assert.equal(canAccessPath(platform, "/venta"), false);
    assert.equal(canAccessPath(platform, "/seguimiento"), false);
    assert.equal(canAccessPath(platform, "/configuracion"), false);
    assert.equal(canAccessPath(platform, "/perfil"), true);
  });
});

describe("canAccessPath own profile", () => {
  it("keeps personal account controls available across every operational role", () => {
    assert.equal(canAccessPath(sellerSession(), "/perfil"), true);
    assert.equal(canAccessPath(driverSession(), "/perfil"), true);
    assert.equal(canAccessPath(distributorSession(), "/perfil"), true);
    assert.equal(canAccessPath(captorSession(), "/perfil"), true);
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

describe("canAccessPath distributor workspace", () => {
  it("isolates distributors in their own workspace", () => {
    assert.equal(canAccessPath(distributorSession(), "/distribuidor"), true);
    assert.equal(canAccessPath(distributorSession(), "/venta"), false);
    assert.equal(canAccessPath(distributorSession(), "/distribuidores"), false);
    assert.equal(canAccessPath(adminSession(), "/distribuidores"), true);
  });
});

describe("canAccessPath captor workspace", () => {
  it("isolates captors to their own distributor portfolio", () => {
    assert.equal(canAccessPath(captorSession(), "/mis-distribuidores"), true);
    assert.equal(canAccessPath(captorSession(), "/distribuidores"), false);
    assert.equal(canAccessPath(captorSession(), "/estadisticas"), false);
    assert.equal(canAccessPath(captorSession(), "/venta"), false);
  });
});

describe("canAccessPath business scopes", () => {
  it("separates agency, finance and logistics surfaces", () => {
    const agencyAdmin = businessRoleSession("administrador_agencia", [
      "agency.sales.view",
      "agency.sales.create",
      "agency.requests.view",
      "agency.requests.create",
    ]);
    const finance = businessRoleSession("finanzas", [
      "accounting.view",
      "accounting.post",
    ]);
    const logistics = businessRoleSession("logistica", [
      "routes.view",
      "agency.requests.assign",
    ]);

    assert.equal(canAccessPath(agencyAdmin, "/agencia"), true);
    assert.equal(canAccessPath(agencyAdmin, "/contabilidad"), false);
    assert.equal(canAccessPath(finance, "/contabilidad"), true);
    assert.equal(canAccessPath(finance, "/agencia"), false);
    assert.equal(canAccessPath(logistics, "/logistica"), true);
    assert.equal(canAccessPath(logistics, "/solicitudes"), true);
  });

  it("reserves the agency team page for its responsible administrator", () => {
    const agencyAdmin = businessRoleSession("administrador_agencia", [
      "agency.sales.view",
      "agency.users.manage",
    ]);
    const agencySeller = businessRoleSession("vendedor_agencia", ["agency.sales.create"]);

    assert.equal(canAccessPath(agencyAdmin, "/agencia/equipo"), true);
    assert.equal(canAccessPath(agencySeller, "/agencia/equipo"), false);
  });

  it("lets supervisors see the agency network without finance access", () => {
    const supervisor = businessRoleSession("supervisor_agencias", [
      "agency.view",
      "agency.captor.assign",
    ]);

    assert.equal(canAccessPath(supervisor, "/agencias"), true);
    assert.equal(canAccessPath(supervisor, "/captacion"), true);
    assert.equal(canAccessPath(supervisor, "/contabilidad"), false);
  });
});
