/**
 * Reinicia la operación local y conserva el catálogo y el acceso.
 *
 * Conserva: auth.users, profiles, organizations, roles, permisos, bodegas,
 * remitentes, destinatarios, categorías, ítems, países y precios.
 * Borra: envíos, rutas, tareas, historial, camiones, datos del conductor,
 * stock operativo y registros de reloj.
 *
 * Solo permite la conexión local validada por db-connection.mjs.
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

const OPERATIONAL_TABLES = [
  "shipment_contact_logs",
  "shipment_logistics_task_attempts",
  "shipment_packages",
  "shipment_payments",
  "logistics_route_live_locations",
  "logistics_route_location_samples",
  "logistics_route_stops",
  "logistics_truck_inventory_events",
  "shipments",
  "logistics_routes",
  "logistics_route_templates",
  "logistics_weekday_defaults",
  "organization_route_settings",
  "logistics_vehicles",
  "warehouse_pallets",
  "inventory_assignments",
  "inventory_movements",
  "inventory_stock",
  "activity_history",
  "organization_invoice_counters",
  "time_clock_alerts",
  "time_clock_events",
  "time_clock_settings",
  "time_clock_employees",
  "time_clock_sessions",
  "distribution_partner_ledger",
  "distribution_partner_owner_history",
];

const PROTECTED_TABLES = [
  "customers",
  "customer_recipients",
  "inventory_categories",
  "inventory_items",
  "pricing_countries",
  "pricing_country_boxes",
  "pricing_promotions",
  "organizations",
  "profiles",
  "warehouses",
];

async function tableExists(client, table) {
  const result = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = $1 limit 1`,
    [table],
  );
  return result.rows.length > 0;
}

async function countTable(client, table, schema = "public") {
  const result = await client.query(`select count(*)::int as count from ${schema}."${table}"`);
  return Number(result.rows[0].count);
}

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  const orgs = await client.query("select id, name, slug from public.organizations order by name");
  const orgIds = orgs.rows.map((row) => row.id);
  const beforeProtected = {};
  for (const table of PROTECTED_TABLES) {
    beforeProtected[table] = await countTable(client, table);
  }
  const beforeUsers = {
    authUsers: await countTable(client, "users", "auth"),
    profiles: await countTable(client, "profiles"),
  };

  console.log("Organizaciones afectadas:", orgs.rows.map((row) => `${row.name} (${row.slug})`).join(", "));
  console.log("Usuarios antes:", beforeUsers);
  console.log("Catálogo protegido antes:", beforeProtected);

  await client.query("begin");
  try {
    const deleted = {};
    for (const table of OPERATIONAL_TABLES) {
      if (!(await tableExists(client, table))) {
        deleted[table] = "omitida (no existe)";
        continue;
      }

      const hasOrganizationId = await client.query(
        `select 1 from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = 'organization_id' limit 1`,
        [table],
      );

      const result = hasOrganizationId.rows.length
        ? await client.query(`delete from public."${table}" where organization_id = any($1::uuid[])`, [orgIds])
        : await client.query(`delete from public."${table}"`);
      deleted[table] = result.rowCount ?? 0;
    }

    for (const table of PROTECTED_TABLES) {
      const after = await countTable(client, table);
      if (after !== beforeProtected[table]) {
        throw new Error(`Protección incumplida: ${table} cambió de ${beforeProtected[table]} a ${after}`);
      }
    }

    const afterUsers = {
      authUsers: await countTable(client, "users", "auth"),
      profiles: await countTable(client, "profiles"),
    };
    if (afterUsers.authUsers !== beforeUsers.authUsers || afterUsers.profiles !== beforeUsers.profiles) {
      throw new Error(`Protección incumplida: usuarios/perfiles cambiaron de ${JSON.stringify(beforeUsers)} a ${JSON.stringify(afterUsers)}`);
    }

    await client.query("commit");
    console.log("Borrado operativo:", deleted);
    console.log("Usuarios después:", afterUsers);
    console.log("Catálogo protegido después:", beforeProtected);
    console.log("Listo: operación reiniciada; catálogo y acceso intactos.");
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
