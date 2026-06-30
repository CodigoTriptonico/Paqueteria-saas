import { readdirSync } from "node:fs";
import { join } from "node:path";

export function listMigrationFiles(root) {
  const migrationsDir = join(root, "supabase", "migrations");
  return readdirSync(migrationsDir)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
}
