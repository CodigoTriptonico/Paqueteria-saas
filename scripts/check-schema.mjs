import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");

const requiredMigrations = readdirSync(migrationsDir)
  .filter((file) => /^\d{3}_.+\.sql$/.test(file))
  .sort();

const requiredTables = [
  "organizations",
  "profiles",
  "profile_phones",
  "roles",
  "permissions",
  "role_permissions",
  "warehouses",
  "profile_warehouses",
  "inventory_categories",
  "inventory_items",
  "inventory_stock",
  "inventory_movements",
  "inventory_assignments",
  "shipments",
  "platform_admins",
  "customers",
  "customer_recipients",
  "pricing_countries",
  "pricing_country_boxes",
  "distributors",
  "distributor_country_boxes",
  "organization_route_settings",
  "organization_invoice_counters",
  "activity_history",
  "app_schema_migrations",
];

let failed = false;

for (const file of requiredMigrations) {
  const path = join(migrationsDir, file);
  if (!existsSync(path)) {
    console.error(`Falta migración: ${file}`);
    failed = true;
    continue;
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

if (!existsSync(join(root, ".env.local.template"))) {
  console.error("Falta .env.local.template");
  failed = true;
} else {
  console.log("OK .env.local.template");
}

if (failed) {
  process.exit(1);
}

console.log("\nSchema validado. Ejecuta: npm run db:apply");
