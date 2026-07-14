import { readdirSync } from "node:fs";
import { join } from "node:path";

export const LEGACY_MIGRATION_ALIASES = {
  "032_shipment_sale_kind.sql": "013_shipment_sale_kind.sql",
  "039_logistics_vehicles.sql": "038_logistics_vehicles.sql",
  "040_logistics_vehicle_photos.sql": "039_logistics_vehicle_photos.sql",
  "041_logistics_task_timestamps.sql": "040_logistics_task_timestamps.sql",
  "042_shipment_contact_logs.sql": "041_shipment_contact_logs.sql",
  "043_atomic_invoice_collection.sql": "042_atomic_invoice_collection.sql",
  "044_shipment_contact_channel_other.sql": "043_shipment_contact_channel_other.sql",
  "045_conductor_truck_inventory.sql": "044_conductor_truck_inventory.sql",
};

export function listMigrationFiles(root) {
  const migrationsDir = join(root, "supabase", "migrations");
  return readdirSync(migrationsDir)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
}
