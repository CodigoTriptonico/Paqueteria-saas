/**
 * Aplica solo 004_organization_kind.sql (idempotente si ya existe kind).
 */
import fs from "fs";
import path from "path";
import { connectPg, projectRoot } from "./lib/db-connection.mjs";

const root = projectRoot;

async function main() {
  const sql = fs.readFileSync(
    path.join(root, "supabase", "migrations", "004_organization_kind.sql"),
    "utf8",
  );

  const { client, label } = await connectPg();
  console.log("Connected to", label);
  console.log("Applying 004_organization_kind.sql...");
  await client.query(sql);

  const { rows } = await client.query(`
    select kind, count(*)::int as count
    from public.organizations
    group by kind
    order by kind
  `);
  console.log("organizations by kind:", rows);
  await client.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
