/**
 * Borra envíos/invoices, rutas logísticas e historial de actividad.
 * Conserva: remitentes, destinatarios, inventario, precios y configuración.
 *
 * Uso: node scripts/clear-sales-history.mjs
 * Opcional: SCGS_ORG_ID=<uuid> para una sola org
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

const TARGET_ORG_ID = process.env.SCGS_ORG_ID?.trim() || "";

/** Delete order: RESTRICT children first, then shipments (packages/payments/tasks cascade). */
const SALES_CLEAR_TABLES = [
  "package_custody_events",
  "package_custody_handoffs",
  "agency_charges",
  "agency_box_allocations",
  "agency_shipment_box_sources",
  "financial_holds",
  "operational_exceptions",
  "sales",
  "logistics_routes",
  "shipments",
  "activity_history",
  "organization_invoice_counters",
];

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

async function clearOrgSalesHistory(client, orgId) {
  const deleted = {};

  for (const table of SALES_CLEAR_TABLES) {
    if (!(await tableExists(client, table))) {
      deleted[table] = "skip (missing)";
      continue;
    }

    const result = await client.query(`delete from public.${table} where organization_id = $1`, [
      orgId,
    ]);
    deleted[table] = result.rowCount ?? 0;
  }

  return deleted;
}

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  const orgQuery = TARGET_ORG_ID
    ? {
        text: "select id, name, slug from public.organizations where id = $1",
        values: [TARGET_ORG_ID],
      }
    : {
        text: "select id, name, slug from public.organizations order by created_at asc",
        values: [],
      };

  const { rows: orgs } = await client.query(orgQuery);

  if (!orgs.length) {
    console.error(TARGET_ORG_ID ? `No existe la org ${TARGET_ORG_ID}` : "No hay organizaciones");
    process.exit(1);
  }

  const snapshot = async (orgId) => ({
    shipments: await count(
      client,
      "select count(*)::int as count from public.shipments where organization_id = $1",
      [orgId],
    ),
    packages: await count(
      client,
      "select count(*)::int as count from public.shipment_packages where organization_id = $1",
      [orgId],
    ),
    custodyEvents: await count(
      client,
      "select count(*)::int as count from public.package_custody_events where organization_id = $1",
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
    inventoryItems: await count(
      client,
      "select count(*)::int as count from public.inventory_items where organization_id = $1",
      [orgId],
    ),
    pricingCountries: await count(
      client,
      "select count(*)::int as count from public.pricing_countries where organization_id = $1",
      [orgId],
    ),
  });

  await client.query("begin");

  try {
    for (const org of orgs) {
      const before = await snapshot(org.id);
      console.log(`\n${org.name} (${org.slug})`);
      console.log("  Antes:", before);

      const deleted = await clearOrgSalesHistory(client, org.id);
      console.log("  Borrado:", deleted);

      const after = await snapshot(org.id);
      console.log("  Después:", after);
    }

    await client.query("commit");
    console.log("\nListo. Remitentes, destinatarios, inventario y precios intactos.");
    console.log("El contador de invoices arranca de nuevo en INV-000001.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
