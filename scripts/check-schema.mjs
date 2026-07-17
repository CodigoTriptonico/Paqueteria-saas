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
  "distribution_partners",
  "distribution_partner_offers",
  "distribution_partner_ledger",
  "distribution_partner_owner_history",
  "organization_route_settings",
  "organization_invoice_counters",
  "activity_history",
  "app_schema_migrations",
  "logistics_vehicles",
  "logistics_routes",
  "logistics_route_stops",
  "shipment_contact_logs",
  "logistics_truck_inventory_events",
  "time_clock_settings",
  "time_clock_employees",
  "time_clock_sessions",
  "time_clock_events",
  "time_clock_alerts",
  "business_tenants",
  "organization_memberships",
  "agencies",
  "agency_status_history",
  "agency_captor_assignments",
  "captor_supervisor_assignments",
  "agency_support_delegations",
  "immutable_audit_events",
  "idempotency_operations",
  "sales",
  "sale_lines",
  "customer_invoices",
  "customer_payments",
  "customer_payment_applications",
  "agency_charges",
  "agency_payments",
  "agency_payment_applications",
  "gl_accounts",
  "journal_entries",
  "journal_lines",
  "driver_cash_custody_events",
  "driver_settlements",
  "financial_holds",
  "agency_service_requests",
  "agency_service_request_lines",
  "agency_visits",
  "agency_visit_lines",
  "agency_box_lots",
  "agency_box_movements",
  "agency_shipment_box_sources",
  "agency_box_allocations",
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
  { table: "organizations", column: "tenant_id" },
  { table: "organizations", column: "organization_type" },
  { table: "organizations", column: "matrix_organization_id" },
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
