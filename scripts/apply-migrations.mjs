/**
 * Applies supabase/migrations/*.sql to your remote Postgres.
 *
 * Required in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
 *   SUPABASE_DB_PASSWORD=your-database-password
 *
 * Optional (for app runtime):
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function projectRefFromUrl(url) {
  const m = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

const MIGRATIONS = [
  "001_roles_permissions_warehouses.sql",
  "002_shipments.sql",
  "003_platform_admin.sql",
];

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl || supabaseUrl.includes("your-project")) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
    console.error("Supabase → Project Settings → API → Project URL");
    process.exit(1);
  }

  if (!dbPassword) {
    console.error("Missing SUPABASE_DB_PASSWORD in .env.local");
    console.error("Same password you set when creating the Supabase project.");
    process.exit(1);
  }

  const ref = projectRefFromUrl(supabaseUrl);
  if (!ref) {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl);
    process.exit(1);
  }

  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres`;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to", ref);

  for (const file of MIGRATIONS) {
    const fullPath = path.join(root, "supabase", "migrations", file);
    if (!fs.existsSync(fullPath)) {
      console.error("Missing migration file:", fullPath);
      process.exit(1);
    }
    const sql = fs.readFileSync(fullPath, "utf8");
    console.log("Applying", file, "...");
    await client.query(sql);
    console.log("OK", file);
  }

  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('organizations', 'shipments', 'platform_admins', 'inventory_stock')
    order by table_name
  `);

  console.log("\nTables found:", rows.map((r) => r.table_name).join(", ") || "(none)");
  if (rows.length < 4) {
    console.warn("Expected 4 core tables; check Supabase dashboard if something failed.");
  } else {
    console.log("Migrations applied successfully.");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
