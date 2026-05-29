import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");

const requiredMigrations = [
  "001_roles_permissions_warehouses.sql",
  "002_shipments.sql",
  "003_platform_admin.sql",
];

const requiredTables = [
  "organizations",
  "profiles",
  "roles",
  "permissions",
  "role_permissions",
  "warehouses",
  "profile_warehouses",
  "inventory_categories",
  "inventory_items",
  "inventory_stock",
  "inventory_movements",
  "shipments",
  "platform_admins",
];

let failed = false;

for (const file of requiredMigrations) {
  const path = join(migrationsDir, file);
  if (!existsSync(path)) {
    console.error(`Falta migración: ${file}`);
    failed = true;
    continue;
  }

  const sql = readFileSync(path, "utf8");
  for (const table of requiredTables) {
    if (!sql.includes(`public.${table}`) && !sql.includes(` ${table} `)) {
      // shipments only in 002
      if (file === "001_roles_permissions_warehouses.sql" && table === "shipments") {
        continue;
      }
      if (file === "002_shipments.sql" && table !== "shipments") {
        continue;
      }
    }
  }

  console.log(`OK ${file}`);
}

const combined = requiredMigrations
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n");

for (const table of requiredTables) {
  if (!combined.includes(table)) {
    console.error(`Tabla no encontrada en migraciones: ${table}`);
    failed = true;
  } else {
    console.log(`OK tabla ${table}`);
  }
}

if (!existsSync(join(root, ".env.example"))) {
  console.error("Falta .env.example");
  failed = true;
} else {
  console.log("OK .env.example");
}

if (failed) {
  process.exit(1);
}

console.log("\nSchema local validado. Ejecuta las migraciones en Supabase SQL Editor.");
