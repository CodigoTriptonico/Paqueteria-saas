/**
 * Reinicia el tutorial de onboarding (estado pausado, sin borrar datos operativos).
 * Los pasos se calculan con los datos existentes: para empezar desde Inventario
 * vacío también hay que limpiar el catálogo con `npm run db:reset:catalog`.
 *
 * Uso: node scripts/reset-onboarding.mjs
 * Opcional: SCGS_ORG_ID=<uuid>
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID?.trim() || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  const { rows } = await client.query(
    `select id, name, settings from public.organizations where id = $1`,
    [SCGS_ORG_ID],
  );

  if (!rows.length) {
    console.error("No se encontró la org:", SCGS_ORG_ID);
    process.exit(1);
  }

  const org = rows[0];
  const settings = { ...(org.settings || {}) };
  delete settings.onboarding_started;
  delete settings.onboarding_dismissed;

  await client.query(`update public.organizations set settings = $1::jsonb where id = $2`, [
    JSON.stringify(settings),
    SCGS_ORG_ID,
  ]);

  console.log(`\nTutorial reiniciado para: ${org.name}`);
  console.log("Org ID:", SCGS_ORG_ID);
  console.log("\nRecarga la app (F5) y pulsa «Iniciar tutorial».");
  console.log(
    "Los datos existentes se conservan y pueden hacer que algunos pasos aparezcan completados.",
  );
  console.log("Para volver al Paso 1 con el catálogo vacío: npm run db:reset:catalog");

  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
