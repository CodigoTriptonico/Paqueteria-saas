/**
 * Limpia países, precios e inventario de la org SCGS (demo local).
 * Conserva remitentes, destinatarios, bodegas y distribuidores.
 *
 * Uso: node scripts/reset-scgs-catalog.mjs
 */
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

const { client } = await connectPg();

try {
  const orgCheck = await client.query(
    "SELECT id, name FROM public.organizations WHERE id = $1",
    [SCGS_ORG_ID],
  );

  if (!orgCheck.rows.length) {
    console.error("No se encontró la org SCGS.");
    process.exit(1);
  }

  console.log(`Limpiando catálogo de: ${orgCheck.rows[0].name}`);

  await client.query("BEGIN");

  const tables = [
    ["pricing_country_boxes", "productos por país"],
    ["distributor_country_boxes", "precios de distribuidor"],
    ["pricing_countries", "países"],
    ["inventory_movements", "movimientos de inventario"],
    ["inventory_stock", "stock por bodega"],
    ["inventory_items", "ítems de inventario"],
    ["inventory_categories", "categorías de inventario"],
    ["organization_route_settings", "rutas y horarios"],
  ];

  for (const [table, label] of tables) {
    const result = await client.query(
      `DELETE FROM public.${table} WHERE organization_id = $1`,
      [SCGS_ORG_ID],
    );
    console.log(`  ${label}: ${result.rowCount} filas`);
  }

  await client.query("COMMIT");

  console.log("\nListo. Países e inventario vacíos.");
  console.log("Flujo sugerido:");
  console.log("  1. Inventario → crear categorías e ítems");
  console.log("  2. Configuración → Países y precios → agregar país y productos");
  console.log("  3. Venta → remitente, destinatario, producto");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
