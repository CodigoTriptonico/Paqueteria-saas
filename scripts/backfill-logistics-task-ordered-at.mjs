/**
 * Rellena ordered_at en tareas logísticas donde falta.
 * Uso: node scripts/backfill-logistics-task-ordered-at.mjs
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  const result = await client.query(`
    update public.shipment_logistics_tasks
    set ordered_at = created_at
    where ordered_at is null
      and status <> 'cancelled'
  `);

  console.log(`Actualizadas ${result.rowCount ?? 0} tareas.`);
  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
