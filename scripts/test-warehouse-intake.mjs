import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log(`Testing formal warehouse intake on ${label}`);

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
      // Preserve the original database error; the outer transaction rolls back.
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
    select organization.id as organization_id, profile.id as user_id,
      warehouse.id as warehouse_id, warehouse.name as warehouse_name
    from public.organizations organization
    join public.profiles profile on profile.organization_id = organization.id and profile.is_active
    join public.roles role on role.id = profile.role_id and role.slug = 'administrador'
    join public.warehouses warehouse on warehouse.organization_id = organization.id and warehouse.is_active
    order by warehouse.is_default desc, profile.created_at
    limit 1
  `);
  assert.equal(contextResult.rowCount, 1, "an active administrator and warehouse are required");
  const context = contextResult.rows[0];
  const routeId = randomUUID();
  const shipmentId = randomUUID();
  const packageId = randomUUID();
  const routeCode = `QA-${randomUUID().slice(0, 8)}`;
  const packageCode = `BX-${randomUUID().slice(0, 8)}`;

  await client.query(`
    insert into public.logistics_routes(
      id, organization_id, route_date, name, status, assigned_to, warehouse_id,
      completed_at, completed_by
    ) values ($1, $2, current_date, $3, 'completed', $4, $5, now(), $4)
  `, [routeId, context.organization_id, routeCode, context.user_id, context.warehouse_id]);
  await client.query(`
    insert into public.shipments(id, organization_id, code, customer_name, country, carrier)
    values ($1, $2, $3, 'Cliente QA', 'Colombia', 'QA')
  `, [shipmentId, context.organization_id, `INV-${randomUUID().slice(0, 8)}`]);
  await client.query(`
    insert into public.shipment_packages(
      id, organization_id, shipment_id, code, country, status, truck_route_id,
      truck_arrived_at, collection_weight_kg, collection_source, collection_recorded_at,
      collection_recorded_by, invoice_code
    ) values ($1, $2, $3, $4, 'Colombia', 'in_truck', $5, now(), 10, 'driver', now(), $6, 'INV-QA-A')
  `, [packageId, context.organization_id, shipmentId, packageCode, routeId, context.user_id]);

  await authenticated(context.user_id, async () => {
    const openKey = randomUUID();
    const opened = await client.query(
      "select public.open_warehouse_intake($1, $2, $3) as id",
      [routeId, context.warehouse_id, openKey],
    );
    const intakeId = opened.rows[0].id;
    const repeatedOpen = await client.query(
      "select public.open_warehouse_intake($1, $2, $3) as id",
      [routeId, context.warehouse_id, openKey],
    );
    assert.equal(repeatedOpen.rows[0].id, intakeId, "open operation is idempotent");

    const beforeScan = await client.query(
      "select status from public.shipment_packages where id = $1",
      [packageId],
    );
    assert.equal(beforeScan.rows[0].status, "in_truck", "unloading does not transfer custody");

    const scanKey = randomUUID();
    const scanned = await client.query(
      "select public.scan_warehouse_intake_package($1, $2, 10, 'correct', '', '', null, $3) as id",
      [intakeId, packageCode, scanKey],
    );
    const itemId = scanned.rows[0].id;
    const repeatedScan = await client.query(
      "select public.scan_warehouse_intake_package($1, $2, 10, 'correct', '', '', null, $3) as id",
      [intakeId, packageCode, scanKey],
    );
    assert.equal(repeatedScan.rows[0].id, itemId, "scan operation is idempotent");

    await expectDatabaseError("duplicate_scan", /PACKAGE_ALREADY_SCANNED/, () => client.query(
      "select public.scan_warehouse_intake_package($1, $2, 10, 'correct', '', '', null, $3)",
      [intakeId, packageCode, randomUUID()],
    ));

    await client.query(
      "select public.scan_warehouse_intake_package($1, 'SIN-ETIQUETA-QA', null, 'unidentified', 'Sin etiqueta legible', 'qa/evidence.webp', null, $2)",
      [intakeId, randomUUID()],
    );
    const closeKey = randomUUID();
    const closed = await client.query(
      "select public.close_warehouse_intake($1, true, '', true, $2) as summary",
      [intakeId, closeKey],
    );
    assert.deepEqual(closed.rows[0].summary, {
      expected: 1,
      received: 2,
      missing: 0,
      unexpected: 0,
      damaged: 0,
      unidentified: 1,
      weightDifferences: 0,
      quarantine: 1,
    });
    const statusResult = await client.query(
      "select status from public.warehouse_intake_sessions where id = $1",
      [intakeId],
    );
    assert.equal(statusResult.rows[0].status, "completed_with_exceptions");

    await expectDatabaseError("scan_after_close", /INTAKE_CLOSED/, () => client.query(
      "select public.scan_warehouse_intake_package($1, 'OTRA-QA', null, 'unidentified', 'Otra', 'qa/otra.webp', null, $2)",
      [intakeId, randomUUID()],
    ));
    await expectDatabaseError("immutable_item", /WAREHOUSE_INTAKE_RECORDS_ARE_APPEND_ONLY/, () => client.query(
      "update public.warehouse_intake_items set note = 'cambio silencioso' where id = $1",
      [itemId],
    ));

    await client.query(
      "select public.reopen_warehouse_intake($1, 'Llegó una caja faltante', $2)",
      [intakeId, randomUUID()],
    );
    const reopened = await client.query(
      "select status, closed_at from public.warehouse_intake_sessions where id = $1",
      [intakeId],
    );
    assert.deepEqual(reopened.rows[0], { status: "in_review", closed_at: null });
    const audit = await client.query(
      "select event_type from public.warehouse_intake_events where session_id = $1 order by created_at",
      [intakeId],
    );
    assert.deepEqual(audit.rows.map((event) => event.event_type), [
      "opened", "scanned", "exception_recorded", "closed", "reopened",
    ]);

    const foundOpenKey = randomUUID();
    const found = await client.query(
      "select public.open_found_warehouse_intake($1, $2) as id",
      [context.warehouse_id, foundOpenKey],
    );
    const foundIntakeId = found.rows[0].id;
    const foundSession = await client.query(
      "select intake_kind, route_id, expected_count from public.warehouse_intake_sessions where id = $1",
      [foundIntakeId],
    );
    assert.deepEqual(foundSession.rows[0], {
      intake_kind: "found_in_warehouse",
      route_id: null,
      expected_count: 0,
    });
    await client.query(
      "select public.scan_found_warehouse_intake_package($1, $2, 10, 'Encontrada junto a la puerta', 'qa/found.webp', $3)",
      [foundIntakeId, packageCode, randomUUID()],
    );
    const foundException = await client.query(
      "select exception_type, blocks_release from public.operational_exceptions where package_id = $1 and exception_type = 'unknown_custody'",
      [packageId],
    );
    assert.deepEqual(foundException.rows[0], { exception_type: "unknown_custody", blocks_release: true });
    const foundClose = await client.query(
      "select public.close_warehouse_intake($1, false, '', true, $2) as summary",
      [foundIntakeId, randomUUID()],
    );
    assert.deepEqual(foundClose.rows[0].summary, {
      expected: 0,
      received: 1,
      missing: 0,
      unexpected: 1,
      damaged: 0,
      unidentified: 0,
      weightDifferences: 0,
      quarantine: 1,
    });
  });

  const custody = await client.query(`
    select holder_type, holder_label
    from public.package_custody_current where package_id = $1
  `, [packageId]);
  assert.equal(custody.rows[0].holder_type, "bodega");
  assert.match(custody.rows[0].holder_label, new RegExp(context.warehouse_name, "i"));

  console.log(JSON.stringify({
    manifestSnapshot: "pass",
    custodyAtPhysicalScan: "pass",
    idempotentScan: "pass",
    duplicateBlocked: "pass",
    unidentifiedQuarantine: "pass",
    reconciledClose: "pass",
    appendOnlyAudit: "pass",
    authorizedReopen: "pass",
    foundWithoutManifest: "pass",
  }, null, 2));
} finally {
  await client.query("rollback");
  await client.end();
}
