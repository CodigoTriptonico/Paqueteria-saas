/**
 * Borra datos operativos de demo (envíos, clientes, inventario, precios, historial).
 *
 * CONSERVA SIEMPRE:
 * - Usuarios auth y perfiles (admin, conductores, vendedores, etc.)
 * - Bodegas y asignaciones profile_warehouses
 * - Roles y permisos
 * - Vehículos de flota (logistics_vehicles)
 *
 * Uso: node scripts/reset-scgs-demo-data.mjs
 * Opcional: SCGS_ORG_ID=<uuid>
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID?.trim() || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

async function count(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return Number(rows[0]?.count ?? 0);
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    `
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = $1
    limit 1
    `,
    [table],
  );
  return rows.length > 0;
}

async function hasColumn(client, table, column) {
  const { rows } = await client.query(
    `
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = $1
      and column_name = $2
    limit 1
    `,
    [table, column],
  );
  return rows.length > 0;
}

async function withDisabledTriggers(client, statements, work) {
  for (const statement of statements) {
    await client.query(statement.disable);
  }
  try {
    return await work();
  } finally {
    for (const statement of [...statements].reverse()) {
      await client.query(statement.enable);
    }
  }
}

async function deleteByOrg(client, table, orgId) {
  if (!(await tableExists(client, table))) {
    return "skip (missing)";
  }

  if (await hasColumn(client, table, "organization_id")) {
    const result = await client.query(
      `delete from public.${table} where organization_id = $1`,
      [orgId],
    );
    return result.rowCount ?? 0;
  }

  if (await hasColumn(client, table, "shipment_id")) {
    const result = await client.query(
      `
      delete from public.${table}
      where shipment_id in (
        select id from public.shipments where organization_id = $1
      )
      `,
      [orgId],
    );
    return result.rowCount ?? 0;
  }

  if (await hasColumn(client, table, "customer_id")) {
    const result = await client.query(
      `
      delete from public.${table}
      where customer_id in (
        select id from public.customers where organization_id = $1
      )
      `,
      [orgId],
    );
    return result.rowCount ?? 0;
  }

  if (await hasColumn(client, table, "route_id")) {
    const result = await client.query(
      `
      delete from public.${table}
      where route_id in (
        select id from public.logistics_routes where organization_id = $1
      )
      `,
      [orgId],
    );
    return result.rowCount ?? 0;
  }

  return "skip (no org scope)";
}

async function wipeOrgDemoData(client, orgId) {
  const deleted = {};

  // Immutable custody facts — disable delete guards only for this admin wipe.
  deleted.package_custody_events = await withDisabledTriggers(
    client,
    [
      {
        disable:
          "alter table public.package_custody_events disable trigger package_custody_events_immutable",
        enable:
          "alter table public.package_custody_events enable trigger package_custody_events_immutable",
      },
    ],
    () => deleteByOrg(client, "package_custody_events", orgId),
  );
  deleted.package_custody_handoffs = await withDisabledTriggers(
    client,
    [
      {
        disable:
          "alter table public.package_custody_handoffs disable trigger package_custody_handoffs_immutable",
        enable:
          "alter table public.package_custody_handoffs enable trigger package_custody_handoffs_immutable",
      },
    ],
    () => deleteByOrg(client, "package_custody_handoffs", orgId),
  );

  // Orden: hijos primero, padres al final.
  const tables = [
    "shipment_payments",
    "shipment_contact_logs",
    "shipment_logistics_task_attempts",
    "shipment_logistics_tasks",
    "shipment_packages",
    "inventory_sale_reservations",
    "agency_box_allocations",
    "agency_shipment_box_sources",
    "agency_charges",
    "agency_service_request_lines",
    "agency_service_requests",
    "agency_box_lots",
    "agency_visits",
    "customer_route_assignment_requests",
    "customer_route_verifications",
    "customer_payments",
    "customer_invoices",
    "sales",
    "distribution_partner_ledger",
    "financial_holds",
    "operational_exceptions",
    "logistics_truck_inventory_events",
    "logistics_route_location_samples",
    "logistics_route_live_locations",
    "logistics_route_stops",
    "warehouse_intake_sessions",
    "logistics_routes",
    "shipments",
    "customer_recipients",
    "customers",
    "activity_history",
    "inventory_assignments",
  ];

  for (const table of tables) {
    deleted[table] = await deleteByOrg(client, table, orgId);
  }

  deleted.inventory_movements = await withDisabledTriggers(
    client,
    [
      {
        disable:
          "alter table public.inventory_movements disable trigger inventory_movements_immutable",
        enable:
          "alter table public.inventory_movements enable trigger inventory_movements_immutable",
      },
    ],
    () => deleteByOrg(client, "inventory_movements", orgId),
  );

  for (const table of [
    "inventory_bin_stock",
    "inventory_warehouse_transfers",
    "inventory_stock",
    "inventory_items",
    "inventory_categories",
    "distributor_country_boxes",
    "distributors",
    "pricing_promotions",
    "pricing_country_boxes",
    "pricing_countries",
    "organization_route_settings",
    "organization_invoice_counters",
  ]) {
    deleted[table] = await deleteByOrg(client, table, orgId);
  }

  return deleted;
}

async function snapshot(client, orgId) {
  return {
    profiles: await count(
      client,
      "select count(*)::int as count from public.profiles where organization_id = $1",
      [orgId],
    ),
    customers: await count(
      client,
      "select count(*)::int as count from public.customers where organization_id = $1",
      [orgId],
    ),
    recipients: await count(
      client,
      "select count(*)::int as count from public.customer_recipients where organization_id = $1",
      [orgId],
    ),
    shipments: await count(
      client,
      "select count(*)::int as count from public.shipments where organization_id = $1",
      [orgId],
    ),
    routes: await count(
      client,
      "select count(*)::int as count from public.logistics_routes where organization_id = $1",
      [orgId],
    ),
    history: await count(
      client,
      "select count(*)::int as count from public.activity_history where organization_id = $1",
      [orgId],
    ),
    items: await count(
      client,
      "select count(*)::int as count from public.inventory_items where organization_id = $1",
      [orgId],
    ),
    warehouses: await count(
      client,
      "select count(*)::int as count from public.warehouses where organization_id = $1",
      [orgId],
    ),
  };
}

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  let orgId = SCGS_ORG_ID;
  let orgRows = (
    await client.query(`select id, name, slug from public.organizations where id = $1`, [orgId])
  ).rows;

  if (!orgRows.length) {
    orgRows = (
      await client.query(
        `select id, name, slug from public.organizations where lower(slug) = 'scgs' limit 1`,
      )
    ).rows;
    if (orgRows.length) {
      orgId = orgRows[0].id;
      console.log(`Org hardcodeada no encontrada; usando slug scgs: ${orgId}`);
    }
  }

  if (!orgRows.length) {
    console.error("No se encontró la org:", SCGS_ORG_ID);
    process.exit(1);
  }

  const org = orgRows[0];
  const before = await snapshot(client, orgId);

  console.log(`\nReset demo: ${org.name} (${org.slug})`);
  console.log("  Antes:", before);
  console.log("  Usuarios: NO se tocan");

  await client.query("begin");

  try {
    const deleted = await wipeOrgDemoData(client, orgId);
    console.log("  Borrado:", deleted);

    const after = await snapshot(client, orgId);
    console.log("  Después:", after);

    if (after.profiles !== before.profiles) {
      throw new Error(
        `Se alteró el conteo de perfiles (${before.profiles} -> ${after.profiles}). Abortando.`,
      );
    }

    await client.query("commit");
    console.log("\nListo. Perfiles, bodegas y usuarios intactos.");
    console.log("Siguiente paso sugerido: npm run db:seed:scgs-demo");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
