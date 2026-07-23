import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log(`Testing conductor route arrival on ${label}`);

async function authenticated(userId, task) {
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  try {
    return await task();
  } finally {
    try {
      await client.query("reset role");
    } catch {
      // The outer transaction restores the connection after an expected error.
    }
  }
}

async function expectDatabaseError(name, pattern, task) {
  await client.query(`savepoint ${name}`);
  try {
    await task();
    assert.fail(`Expected database error: ${pattern}`);
  } catch (error) {
    assert.match(String(error.message), pattern);
  } finally {
    await client.query(`rollback to savepoint ${name}`);
    await client.query(`release savepoint ${name}`);
  }
}

await client.query("begin");
try {
  const contextResult = await client.query(`
    select organization.id as organization_id, profile.id as driver_id,
      warehouse.id as warehouse_id
    from public.organizations organization
    join public.profiles profile on profile.organization_id = organization.id and profile.is_active
    join public.roles role on role.id = profile.role_id and role.slug = 'conductor'
    join public.warehouses warehouse on warehouse.organization_id = organization.id and warehouse.is_active
    order by warehouse.is_default desc, profile.created_at
    limit 1
  `);
  assert.equal(contextResult.rowCount, 1, "an active conductor and warehouse are required");
  const context = contextResult.rows[0];
  const arrivalWarehouseId = randomUUID();
  const routeId = randomUUID();
  const openRouteId = randomUUID();
  const shipmentId = randomUUID();
  const openShipmentId = randomUUID();
  const taskId = randomUUID();
  const openTaskId = randomUUID();
  const packageId = randomUUID();
  const operationKey = randomUUID();

  await client.query(`
    insert into public.warehouses(id, organization_id, name, code, is_active)
    values ($1, $2, 'Bodega llegada QA', 'ARR-QA', true)
  `, [arrivalWarehouseId, context.organization_id]);
  await client.query(`
    insert into public.shipments(id, organization_id, code, customer_name, country, carrier)
    values
      ($1, $3, $4, 'Cliente llegada QA', 'Colombia', 'QA'),
      ($2, $3, $5, 'Cliente abierta QA', 'Colombia', 'QA')
  `, [shipmentId, openShipmentId, context.organization_id,
    `INV-${randomUUID().slice(0, 8)}`, `INV-${randomUUID().slice(0, 8)}`]);
  await client.query(`
    insert into public.shipment_logistics_tasks(
      id, organization_id, shipment_id, task_type, status, assigned_to, scheduled_at, warehouse_id
    ) values
      ($1, $3, $5, 'pickup_full_box', 'completed', $4, now(), $7),
      ($2, $3, $6, 'pickup_full_box', 'loaded_to_truck', $4, now(), $7)
  `, [taskId, openTaskId, context.organization_id, context.driver_id,
    shipmentId, openShipmentId, context.warehouse_id]);
  await client.query(`
    insert into public.logistics_routes(
      id, organization_id, route_date, name, status, assigned_to, warehouse_id, started_at, started_by
    ) values
      ($1, $3, current_date, 'Ruta llegada QA', 'in_progress', $4, $5, now(), $4),
      ($2, $3, current_date, 'Ruta abierta QA', 'in_progress', $4, $5, now(), $4)
  `, [routeId, openRouteId, context.organization_id, context.driver_id, context.warehouse_id]);
  await client.query(`
    insert into public.logistics_route_stops(
      organization_id, route_id, task_id, stop_order, outcome, outcome_at
    ) values
      ($1, $2, $4, 1, 'completed', now()),
      ($1, $3, $5, 1, null, null)
  `, [context.organization_id, routeId, openRouteId, taskId, openTaskId]);
  await client.query(`
    insert into public.shipment_packages(
      id, organization_id, shipment_id, code, country, status, truck_route_id,
      collection_weight_kg, collection_source, collection_recorded_at,
      collection_recorded_by, invoice_code
    ) values ($1, $2, $3, $4, 'Colombia', 'in_truck', $5, 8, 'driver', now(), $6, 'INV-QA-A')
  `, [packageId, context.organization_id, shipmentId, `BX-${randomUUID().slice(0, 8)}`,
    routeId, context.driver_id]);

  await authenticated(context.driver_id, async () => {
    await expectDatabaseError("open_stops", /ROUTE_HAS_OPEN_STOPS/, () => client.query(
      "select public.complete_conductor_route_arrival($1, $2, 'unfinished_stops', '', now(), $3)",
      [openRouteId, context.warehouse_id, randomUUID()],
    ));
    await expectDatabaseError("changed_without_note", /WAREHOUSE_CHANGE_NOTE_REQUIRED/, () => client.query(
      "select public.complete_conductor_route_arrival($1, $2, 'completed_normally', '', now(), $3)",
      [routeId, arrivalWarehouseId, randomUUID()],
    ));

    const capturedAt = new Date(Date.now() - 60_000).toISOString();
    const completed = await client.query(
      "select public.complete_conductor_route_arrival($1, $2, 'completed_normally', 'Cambio autorizado', $3, $4) as id",
      [routeId, arrivalWarehouseId, capturedAt, operationKey],
    );
    assert.equal(completed.rows[0].id, routeId);
    const repeated = await client.query(
      "select public.complete_conductor_route_arrival($1, $2, 'completed_normally', 'Cambio autorizado', $3, $4) as id",
      [routeId, arrivalWarehouseId, capturedAt, operationKey],
    );
    assert.equal(repeated.rows[0].id, routeId, "arrival confirmation is idempotent");
  });

  const route = await client.query(`
    select status, warehouse_id, arrival_warehouse_id, arrival_reason_code, arrival_note,
      arrival_reported_at, arrival_confirmed_at, arrival_confirmed_by
    from public.logistics_routes where id = $1
  `, [routeId]);
  assert.equal(route.rows[0].status, "completed");
  assert.equal(route.rows[0].warehouse_id, context.warehouse_id, "planned warehouse is preserved");
  assert.equal(route.rows[0].arrival_warehouse_id, arrivalWarehouseId, "actual warehouse is recorded");
  assert.equal(route.rows[0].arrival_reason_code, "completed_normally");
  assert.equal(route.rows[0].arrival_note, "Cambio autorizado");
  assert.equal(route.rows[0].arrival_confirmed_by, context.driver_id);
  assert.ok(route.rows[0].arrival_reported_at);
  assert.ok(route.rows[0].arrival_confirmed_at);

  const packageResult = await client.query(`
    select status, warehouse_id, truck_arrived_at
    from public.shipment_packages where id = $1
  `, [packageId]);
  assert.equal(packageResult.rows[0].status, "in_truck", "custody remains with the driver until scan");
  assert.equal(packageResult.rows[0].warehouse_id, arrivalWarehouseId);
  assert.ok(packageResult.rows[0].truck_arrived_at);

  const custody = await client.query(`
    select holder_type from public.package_custody_current where package_id = $1
  `, [packageId]);
  assert.equal(custody.rows[0].holder_type, "conductor");
  const history = await client.query(`
    select metadata from public.activity_history
    where entity_id = $1 and action = 'logistics.route_arrived_at_warehouse'
  `, [routeId]);
  assert.equal(history.rowCount, 1);
  assert.equal(history.rows[0].metadata.arrivalWarehouseId, arrivalWarehouseId);

  console.log(JSON.stringify({
    explicitDriverConfirmation: "pass",
    openStopsBlocked: "pass",
    warehouseChangeExplained: "pass",
    actualWarehouseRecorded: "pass",
    packageCustodyUntilScan: "pass",
    idempotentRetry: "pass",
    auditTrace: "pass",
  }, null, 2));
} finally {
  await client.query("rollback");
  await client.end();
}
