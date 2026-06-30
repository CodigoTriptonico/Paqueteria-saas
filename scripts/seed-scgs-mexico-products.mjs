/**
 * Catálogo de cajas en inventario + productos asignados a México (demo local SCGS).
 * Uso: node scripts/seed-scgs-mexico-products.mjs
 */
import { randomUUID } from "node:crypto";
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const MEXICO_COUNTRY = "México";

const boxProducts = [
  { size: "Caja chiquita", price: "$35", cost: "$22" },
  { size: "Caja mediana", price: "$50", cost: "$31" },
  { size: "Caja grande", price: "$65", cost: "$40" },
  { size: "Caja familiar", price: "$85", cost: "$52" },
  { size: "Caja jumbo", price: "$105", cost: "$65" },
];

function normalizeLabel(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function catalogKey(category, kind, subcategory = "") {
  return [normalizeLabel(category), normalizeLabel(kind), normalizeLabel(subcategory)].join("|");
}

const { client } = await connectPg();

try {
  const orgCheck = await client.query(
    "SELECT id FROM public.organizations WHERE id = $1",
    [SCGS_ORG_ID],
  );

  if (!orgCheck.rows.length) {
    console.error("No se encontró la org SCGS.");
    process.exit(1);
  }

  const categoryRow = await client.query(
    `SELECT id, name, tree_data
     FROM public.inventory_categories
     WHERE organization_id = $1
     ORDER BY name
     LIMIT 1`,
    [SCGS_ORG_ID],
  );

  let categoryName = "cajas";

  if (!categoryRow.rows.length) {
    const treeData = [
      {
        id: randomUUID(),
        name: "Estándar",
        children: boxProducts.map((product) => ({
          id: randomUUID(),
          name: product.size,
        })),
      },
    ];

    await client.query(
      `INSERT INTO public.inventory_categories (organization_id, name, tree_data)
       VALUES ($1, $2, $3::jsonb)`,
      [SCGS_ORG_ID, categoryName, JSON.stringify(treeData)],
    );
    console.log("OK: categoría cajas creada con productos");
  } else {
    const row = categoryRow.rows[0];
    categoryName = row.name;
    const tree = Array.isArray(row.tree_data) ? row.tree_data : [];

    if (!tree.length) {
      const treeData = [
        {
          id: randomUUID(),
          name: "Estándar",
          children: boxProducts.map((product) => ({
            id: randomUUID(),
            name: product.size,
          })),
        },
      ];

      await client.query(
        `UPDATE public.inventory_categories
         SET tree_data = $1::jsonb
         WHERE id = $2`,
        [JSON.stringify(treeData), row.id],
      );
      console.log(`OK: productos agregados a categoría ${categoryName}`);
    } else {
      console.log(`Skip: categoría ${categoryName} ya tiene estructura`);
    }
  }

  const mexico = await client.query(
    `SELECT id FROM public.pricing_countries
     WHERE organization_id = $1
       AND lower(translate(name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = 'mexico'
     LIMIT 1`,
    [SCGS_ORG_ID],
  );

  if (!mexico.rows.length) {
    console.error("No hay país México en precios. Agrégalo en Configuración primero.");
    process.exit(1);
  }

  const countryId = mexico.rows[0].id;
  let inserted = 0;

  for (const product of boxProducts) {
    const key = catalogKey(categoryName, product.size, "Estándar");

    const exists = await client.query(
      `SELECT id FROM public.pricing_country_boxes
       WHERE country_id = $1 AND catalog_key = $2`,
      [countryId, key],
    );

    if (exists.rows.length) {
      console.log(`Skip: ${product.size} ya asignado a ${MEXICO_COUNTRY}`);
      continue;
    }

    await client.query(
      `INSERT INTO public.pricing_country_boxes (
        organization_id, country_id, size, price, cost, catalog_key
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [SCGS_ORG_ID, countryId, product.size, product.price, product.cost, key],
    );

    inserted += 1;
    console.log(`OK: ${product.size} → ${MEXICO_COUNTRY} (${product.price})`);
  }

  const total = await client.query(
    `SELECT count(*)::int AS total FROM public.pricing_country_boxes WHERE country_id = $1`,
    [countryId],
  );

  console.log(
    `\nInsertados: ${inserted}. Productos en ${MEXICO_COUNTRY}: ${total.rows[0].total}.`,
  );
} finally {
  await client.end();
}
