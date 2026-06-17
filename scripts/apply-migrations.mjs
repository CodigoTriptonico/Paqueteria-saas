/**
 * Applies supabase/migrations/*.sql against local Postgres (Supabase CLI).
 *
 * Requires: DATABASE_MODE=local + `npm run supabase:start`
 */
import fs from "fs";
import path from "path";
import { connectPg, projectRoot } from "./lib/db-connection.mjs";

const root = projectRoot;

const MIGRATIONS = [
  "001_roles_permissions_warehouses.sql",
  "002_shipments.sql",
  "003_platform_admin.sql",
  "004_organization_kind.sql",
  "005_customers.sql",
  "006_pricing.sql",
  "007_shipments_sales.sql",
  "008_profile_phone.sql",
  "009_bootstrap_phone_overload.sql",
  "010_profile_recovery_phones.sql",
  "011_enable_rls_app_schema_migrations.sql",
  "012_activity_history.sql",
  "013_custom_roles.sql",
  "014_customer_referrals.sql",
  "015_repair_plan_limits.sql",
  "016_warehouse_access_explicit.sql",
  "017_profile_default_warehouse.sql",
  "018_profile_phones_org_manage.sql",
  "019_inventory_assignments.sql",
  "020_pricing_catalog_key.sql",
  "021_inventory_categories_adjust_write.sql",
];

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.app_schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );

    alter table public.app_schema_migrations enable row level security;
  `);
}

async function isMigrationApplied(client, name) {
  const { rows } = await client.query(
    `select 1 from public.app_schema_migrations where name = $1 limit 1`,
    [name],
  );
  return rows.length > 0;
}

async function markMigrationApplied(client, name) {
  await client.query(
    `insert into public.app_schema_migrations (name) values ($1) on conflict (name) do nothing`,
    [name],
  );
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = $1
    limit 1
  `,
    [tableName],
  );
  return rows.length > 0;
}

/** Mark legacy migrations as applied when DB was created before tracking table existed. */
async function bootstrapLegacyMigrations(client) {
  const legacyMarkers = [
    { file: "001_roles_permissions_warehouses.sql", table: "organizations" },
    { file: "002_shipments.sql", table: "shipments" },
    { file: "003_platform_admin.sql", table: "platform_admins" },
    { file: "004_organization_kind.sql", table: "organizations" },
    { file: "005_customers.sql", table: "customers" },
    { file: "006_pricing.sql", table: "pricing_countries" },
    { file: "007_shipments_sales.sql", table: "organization_invoice_counters" },
    { file: "008_profile_phone.sql", table: "profiles" },
    { file: "009_bootstrap_phone_overload.sql", table: "profiles" },
    { file: "010_profile_recovery_phones.sql", table: "profile_phones" },
    { file: "011_enable_rls_app_schema_migrations.sql", table: "app_schema_migrations" },
    { file: "012_activity_history.sql", table: "activity_history" },
    { file: "013_custom_roles.sql", table: "roles" },
  ];

  for (const { file, table } of legacyMarkers) {
    if (await isMigrationApplied(client, file)) {
      continue;
    }

    if (await tableExists(client, table)) {
      await markMigrationApplied(client, file);
      console.log("Marked as already applied:", file);
    }
  }
}

async function main() {
  const { client, label } = await connectPg();
  console.log("Connected to", label);

  await ensureMigrationsTable(client);
  await bootstrapLegacyMigrations(client);

  for (const file of MIGRATIONS) {
    if (await isMigrationApplied(client, file)) {
      console.log("Skip", file, "(already applied)");
      continue;
    }

    const fullPath = path.join(root, "supabase", "migrations", file);
    if (!fs.existsSync(fullPath)) {
      console.error("Missing migration file:", fullPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(fullPath, "utf8");
    console.log("Applying", file, "...");

    try {
      await client.query(sql);
      await markMigrationApplied(client, file);
      console.log("OK", file);
    } catch (error) {
      console.error("Failed", file, ":", error.message || error);
      process.exit(1);
    }
  }

  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'customers',
        'customer_recipients',
        'pricing_countries',
        'pricing_country_boxes',
        'distributors',
        'organization_route_settings',
        'organization_invoice_counters',
        'activity_history'
      )
    order by table_name
  `);

  console.log("\nNew tables:", rows.map((r) => r.table_name).join(", ") || "(none)");
  console.log("Done.");

  await client.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
