import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log("DB:", label);

const recipients = await client.query(`
  SELECT country, count(*)::int AS n
  FROM public.customer_recipients
  GROUP BY country
  ORDER BY n DESC, country
`);

const pricing = await client.query(`
  SELECT pc.name, pc.code, count(pcb.id)::int AS boxes
  FROM public.pricing_countries pc
  LEFT JOIN public.pricing_country_boxes pcb ON pcb.country_id = pc.id
  GROUP BY pc.id, pc.name, pc.code
  ORDER BY pc.name
`);

const inventory = await client.query(`
  SELECT organization_id, name, tree_data
  FROM public.inventory_categories
  ORDER BY name
`);

const org = await client.query(
  "SELECT id, name FROM organizations WHERE kind = 'client' LIMIT 5",
);

console.log("\n=== ORGS ===");
console.table(org.rows);

console.log("\n=== DESTINATARIOS POR PAIS ===");
console.table(recipients.rows);

console.log("\n=== PAISES EN PRECIOS ===");
console.table(pricing.rows);

console.log("\n=== INVENTARIO ===");
for (const row of inventory.rows) {
  console.log("Categoria:", row.name, `(org ${row.organization_id})`);
  const tree = row.tree_data;
  const leaves = [];
  function walk(items, path = []) {
    for (const item of items || []) {
      if (item.children?.length) walk(item.children, [...path, item.name]);
      else leaves.push([...path, item.name].join(" / "));
    }
  }
  walk(Array.isArray(tree) ? tree : []);
  console.log("  Productos:", leaves.join(", ") || "(vacío)");
}

const detail = await client.query(`
  SELECT pc.name AS country, pcb.size, pcb.price, pcb.cost, pcb.catalog_key
  FROM public.pricing_country_boxes pcb
  JOIN public.pricing_countries pc ON pc.id = pcb.country_id
  ORDER BY pc.name, pcb.size
`);
console.log("\n=== PRECIOS ACTUALES ===");
console.table(detail.rows);

await client.end();
