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

async function wipeOrgDemoData(client, orgId) {
  const tables = [
    "logistics_truck_inventory_events",
    "shipment_logistics_task_attempts",
    "logistics_routes",
    "shipments",
    "customer_recipients",
    "customers",
    "activity_history",
    "inventory_assignments",
    "inventory_movements",
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
  ];

  const deleted = {};

  for (const table of tables) {
    const exists = await client.query(
      `
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = $1
      limit 1
      `,
      [table],
    );

    if (!exists.rows.length) {
      deleted[table] = "skip (missing)";
      continue;
    }

    const result = await client.query(
      `delete from public.${table} where organization_id = $1`,
      [orgId],
    );
    deleted[table] = result.rowCount ?? 0;
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

  const { rows: orgRows } = await client.query(
    `select id, name, slug from public.organizations where id = $1`,
    [SCGS_ORG_ID],
  );

  if (!orgRows.length) {
    console.error("No se encontró la org:", SCGS_ORG_ID);
    process.exit(1);
  }

  const org = orgRows[0];
  const before = await snapshot(client, SCGS_ORG_ID);

  console.log(`\nReset demo: ${org.name} (${org.slug})`);
  console.log("  Antes:", before);
  console.log("  Usuarios: NO se tocan");

  await client.query("begin");

  try {
    const deleted = await wipeOrgDemoData(client, SCGS_ORG_ID);
    console.log("  Borrado:", deleted);

    const after = await snapshot(client, SCGS_ORG_ID);
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
