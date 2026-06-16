/**
 * Aplica la reparación de límites de plan (015_repair_plan_limits.sql).
 */
import fs from "fs";
import path from "path";
import { connectPg, projectRoot } from "./lib/db-connection.mjs";

const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "015_repair_plan_limits.sql",
);

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const { client } = await connectPg();

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Reparación de límites de plan aplicada.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
