/**
 * Elimina todos los usuarios auth y todas las organizaciones (datos operativos).
 * Conserva: permissions, app_schema_migrations.
 */
import { connectPg } from "./lib/db-connection.mjs";

async function count(client, sql) {
  const { rows } = await client.query(sql);
  return Number(rows[0]?.count ?? 0);
}

const { client, label } = await connectPg();
console.log("Connected to", label);

const before = {
  authUsers: await count(client, "select count(*)::int as count from auth.users"),
  profiles: await count(client, "select count(*)::int as count from public.profiles"),
  organizations: await count(client, "select count(*)::int as count from public.organizations"),
};

console.log("Antes:", before);

await client.query("begin");
try {
  await client.query("delete from public.organizations");
  await client.query("delete from auth.users");
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
}

const after = {
  authUsers: await count(client, "select count(*)::int as count from auth.users"),
  profiles: await count(client, "select count(*)::int as count from public.profiles"),
  organizations: await count(client, "select count(*)::int as count from public.organizations"),
};

console.log("Después:", after);
console.log("\nUsuarios y organizaciones eliminados. Para volver a entrar:");
console.log("  npm run db:restore-owner");
console.log("  o crea una paquetería en /platform tras registrarte de nuevo.");

await client.end();
