import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LEGACY_MIGRATION_ALIASES, listMigrationFiles } from "./migrations.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const RENAMED_MIGRATION_ALIASES = {
  "039_logistics_vehicles.sql": "038_logistics_vehicles.sql",
  "040_logistics_vehicle_photos.sql": "039_logistics_vehicle_photos.sql",
  "041_logistics_task_timestamps.sql": "040_logistics_task_timestamps.sql",
  "042_shipment_contact_logs.sql": "041_shipment_contact_logs.sql",
  "043_atomic_invoice_collection.sql": "042_atomic_invoice_collection.sql",
  "044_shipment_contact_channel_other.sql": "043_shipment_contact_channel_other.sql",
  "045_conductor_truck_inventory.sql": "044_conductor_truck_inventory.sql",
};

test("legacy migration aliases cover every renamed migration file", () => {
  for (const [newFile, oldFile] of Object.entries(RENAMED_MIGRATION_ALIASES)) {
    assert.equal(LEGACY_MIGRATION_ALIASES[newFile], oldFile);
  }
});

test("legacy migration aliases keep the original sale_kind rename", () => {
  assert.equal(LEGACY_MIGRATION_ALIASES["032_shipment_sale_kind.sql"], "013_shipment_sale_kind.sql");
});

test("migration directory contains only the canonical side of every rename", () => {
  const files = listMigrationFiles(root);
  const legacyFiles = new Set(Object.values(LEGACY_MIGRATION_ALIASES));

  assert.deepEqual(
    files.filter((file) => legacyFiles.has(file)),
    [],
  );
});

test("migration sequence prefixes and normalized contents are unique", () => {
  const files = listMigrationFiles(root);
  const sequenceOwner = new Map();
  const contentOwner = new Map();

  for (const file of files) {
    const sequence = file.slice(0, 3);
    assert.equal(sequenceOwner.has(sequence), false, `${file} duplicates the sequence used by ${sequenceOwner.get(sequence)}`);
    sequenceOwner.set(sequence, file);

    const normalizedContent = readFileSync(join(root, "supabase", "migrations", file), "utf8")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .trim();
    assert.equal(contentOwner.has(normalizedContent), false, `${file} duplicates ${contentOwner.get(normalizedContent)}`);
    contentOwner.set(normalizedContent, file);
  }
});
