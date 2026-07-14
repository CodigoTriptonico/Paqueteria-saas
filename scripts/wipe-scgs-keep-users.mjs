/**
 * Limpieza extra tras db:reset:scgs: tablas no incluidas en el reset + usuarios
 * excepto los emails en KEEP_EMAILS (admin + Felipe).
 *
 * Uso: node scripts/wipe-scgs-keep-users.mjs
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID?.trim() || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const KEEP_EMAILS = ["pablo.isaza.i@gmail.com", "scgs@gmail.com"];

const EXTRA_TABLES = [
  { table: "time_clock_alerts", column: "organization_id" },
  { table: "time_clock_events", column: "organization_id", disableImmutable: true },
  { table: "time_clock_employees", column: "organization_id" },
  { table: "time_clock_settings", column: "organization_id" },
  { table: "warehouse_pallets", column: "organization_id" },
  { table: "logistics_route_templates", column: "organization_id" },
  { table: "shipment_packages", column: "organization_id" },
];

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  await client.query("begin");
  try {
    for (const entry of EXTRA_TABLES) {
      const { table, column, disableImmutable } = entry;
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
        continue;
      }

      if (disableImmutable) {
        await client.query(
          "alter table public.time_clock_events disable trigger time_clock_events_immutable",
        );
      }

      const result = await client.query(
        `delete from public.${table} where ${column} = $1`,
        [SCGS_ORG_ID],
      );
      console.log(`  ${table}: ${result.rowCount ?? 0}`);

      if (disableImmutable) {
        await client.query(
          "alter table public.time_clock_events enable trigger time_clock_events_immutable",
        );
      }
    }

    const { rows: toDelete } = await client.query(
      `
      select id, email
      from auth.users
      where lower(email) <> all($1::text[])
      `,
      [KEEP_EMAILS],
    );

    for (const user of toDelete) {
      await client.query("delete from auth.users where id = $1", [user.id]);
      console.log(`  usuario eliminado: ${user.email}`);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const { rows: remaining } = await client.query(`
    select u.email, p.full_name, o.name as org, r.name as role
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.organizations o on o.id = p.organization_id
    left join public.roles r on r.id = p.role_id
    order by u.email
  `);

  console.log("\nUsuarios restantes:");
  for (const row of remaining) {
    console.log(`  ${row.email} | ${row.full_name} | ${row.org} | ${row.role}`);
  }

  const { rows: counts } = await client.query(
    `
    select
      (select count(*)::int from public.customers where organization_id = $1) as customers,
      (select count(*)::int from public.customer_recipients where organization_id = $1) as recipients,
      (select count(*)::int from public.shipments where organization_id = $1) as shipments,
      (select count(*)::int from public.inventory_items where organization_id = $1) as items
    `,
    [SCGS_ORG_ID],
  );

  console.log("\nSCGS datos:", counts[0]);
  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
