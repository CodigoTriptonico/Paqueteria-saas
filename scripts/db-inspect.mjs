import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log("Connected to", label);

const migrations = await client.query(
  "select name, applied_at from public.app_schema_migrations order by applied_at",
);
const counts = await client.query(`
  select
    (select count(*)::int from organizations) as organizations,
    (select count(*)::int from profiles) as profiles,
    (select count(*)::int from organizations where kind = 'client') as client_orgs,
    (select count(*)::int from platform_admins) as platform_admins,
    (select count(*)::int from customers) as customers,
    (select count(*)::int from shipments) as shipments
`);
const orgs = await client.query(
  "select name, slug, kind, is_active from organizations order by created_at desc limit 8",
);
const phoneCol = await client.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name in ('phone', 'phone_digits', 'phone_verified_at')
  order by column_name
`);

console.log(JSON.stringify({ database: label, migrations: migrations.rows, counts: counts.rows[0], orgs: orgs.rows, phoneColumns: phoneCol.rows.map((r) => r.column_name) }, null, 2));

await client.end();
