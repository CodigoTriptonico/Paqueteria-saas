import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSurfaceContextFromPathname } from "./ui-surface-route-context.ts";

describe("ui surface route context", () => {
  it("maps operational list pages to their surface contexts", () => {
    assert.equal(resolveSurfaceContextFromPathname("/logistica"), "logistics.tasks");
    assert.equal(resolveSurfaceContextFromPathname("/seguimiento"), "shipments.tracking");
    assert.equal(resolveSurfaceContextFromPathname("/seguimiento/historial"), "shipments.tracking");
    assert.equal(resolveSurfaceContextFromPathname("/envios"), "shipments.tracking");
    assert.equal(resolveSurfaceContextFromPathname("/envios/historial"), "shipments.tracking");
    assert.equal(resolveSurfaceContextFromPathname("/conductor/tareas"), "conductor.tasks");
    assert.equal(resolveSurfaceContextFromPathname("/estadisticas"), "stats.sales");
    assert.equal(resolveSurfaceContextFromPathname("/time-clock"), "timeclock.admin");
    assert.equal(resolveSurfaceContextFromPathname("/venta"), "sale.senderCard");
  });

  it("assigns every view-switching page a sidebar preference context", () => {
    assert.equal(resolveSurfaceContextFromPathname("/configuracion"), null);
    assert.equal(resolveSurfaceContextFromPathname("/inventario"), "inventory.items");
    assert.equal(resolveSurfaceContextFromPathname("/auditoria"), "audit.shipments");
    assert.equal(resolveSurfaceContextFromPathname("/ingreso-bodega"), "warehouse.intake");
    assert.equal(resolveSurfaceContextFromPathname("/bodega"), "warehouse.inventory");
    assert.equal(resolveSurfaceContextFromPathname("/paletas"), "warehouse.pallets");
    assert.equal(resolveSurfaceContextFromPathname("/conductor/inventario-camion"), null);
  });
});
