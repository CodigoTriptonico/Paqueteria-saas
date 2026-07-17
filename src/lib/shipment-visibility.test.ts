import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppSession } from "@/lib/auth/types";
import { canChangeShipmentSalesOwner, canManageAllShipments, shipmentVisibilityScope } from "@/lib/shipment-visibility";

function session(overrides: Partial<AppSession> = {}): AppSession {
  return {
    userId: "user-1",
    email: "user@test.com",
    fullName: "User",
    organizationId: "org-1",
    organizationName: "Org",
    multiWarehouseEnabled: false,
    maxWarehouses: 1,
    roleSlug: "vendedor",
    roleName: "Vendedor",
    permissions: ["sales.manage"],
    warehouseIds: [],
    preferredWarehouseId: null,
    isPlatformAdmin: false,
    ...overrides,
  };
}

describe("shipment visibility", () => {
  it("lets admin see all shipments", () => {
    const admin = session({ roleSlug: "administrador", permissions: ["all"] });

    assert.equal(canManageAllShipments(admin), true);
    assert.equal(shipmentVisibilityScope(admin), "all");
  });

  it("limits sellers to owned shipments", () => {
    assert.equal(shipmentVisibilityScope(session()), "sales_owner");
  });

  it("only lets administrador change shipment sales owner", () => {
    const admin = session({ roleSlug: "administrador", permissions: ["all"] });
    const sellerWithAll = session({ roleSlug: "vendedor", permissions: ["all"] });

    assert.equal(canChangeShipmentSalesOwner(admin), true);
    assert.equal(canChangeShipmentSalesOwner(sellerWithAll), false);
    assert.equal(canChangeShipmentSalesOwner(session()), false);
    assert.equal(canManageAllShipments(sellerWithAll), true);
  });

  it("limits drivers to assigned shipments", () => {
    const driver = session({ roleSlug: "conductor", permissions: ["routes.view"] });

    assert.equal(shipmentVisibilityScope(driver), "driver");
  });

  it("blocks sessions without sales or route access", () => {
    assert.equal(shipmentVisibilityScope(session({ permissions: [] })), "none");
  });
});
