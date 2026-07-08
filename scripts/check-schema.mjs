import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { listMigrationFiles } from "./lib/migrations.mjs";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");

const requiredMigrations = listMigrationFiles(root);

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
  "shipment_logistics_tasks",
  "shipment_payments",
  "platform_admins",
  "customers",
  "customer_recipients",
  "pricing_countries",
  "pricing_country_boxes",
  "pricing_promotions",
  "distributors",
  "distributor_country_boxes",
  "organization_route_settings",
  "organization_invoice_counters",
  "activity_history",
  "app_schema_migrations",
  "logistics_vehicles",
  "logistics_routes",
  "logistics_route_stops",
  "shipment_contact_logs",
  "logistics_truck_inventory_events",
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

const requiredColumns = [
  { table: "logistics_routes", column: "vehicle_id" },
];

for (const { table, column } of requiredColumns) {
  const pattern = new RegExp(`alter\\s+table\\s+public\\.${table}[\\s\\S]*${column}`, "i");

  if (!pattern.test(combined)) {
    console.error(`Columna no encontrada en migraciones: ${table}.${column}`);
    failed = true;
  } else {
    console.log(`OK columna ${table}.${column}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("\nSchema validado. Ejecuta: npm run db:apply");
