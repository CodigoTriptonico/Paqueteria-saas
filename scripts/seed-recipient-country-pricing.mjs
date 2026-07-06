/**
 * Asegura países de precios y productos (público + costo) para cada país con destinatarios.
 * No sobrescribe precios ya configurados.
 * Uso: node scripts/seed-recipient-country-pricing.mjs
 */
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";
const CATEGORY_NAME = "cajas";

const COUNTRY_META = {
  México: { code: "MX", deliveryTime: "3-5 dias", sortOrder: 0 },
  Colombia: { code: "CO", deliveryTime: "7-10 dias", sortOrder: 1 },
  Guatemala: { code: "GT", deliveryTime: "5-8 dias", sortOrder: 2 },
  "El Salvador": { code: "SV", deliveryTime: "5-8 dias", sortOrder: 3 },
  Honduras: { code: "HN", deliveryTime: "5-8 dias", sortOrder: 4 },
  Nicaragua: { code: "NI", deliveryTime: "6-9 dias", sortOrder: 5 },
};

const DEFAULT_BOX_PRICES = {
  "14x14x14": { price: "$35", cost: "$22" },
  "16x16x16": { price: "$50", cost: "$31" },
  "18x18x18": { price: "$65", cost: "$40" },
};

function normalizeLabel(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeCountryName(country) {
  return normalizeLabel(country);
}

function catalogKey(kind, subcategory = "") {
  return [normalizeLabel(CATEGORY_NAME), normalizeLabel(kind), normalizeLabel(subcategory)].join(
    "|",
  );
}

function collectInventoryProducts(treeData) {
  const products = [];

  for (const item of treeData || []) {
    if (item.children?.length) {
      for (const child of item.children) {
        products.push({ name: child.name, subcategory: item.name });
      }
      continue;
    }

    products.push({ name: item.name, subcategory: "" });
  }

  return products;
}

function resolveCountryMeta(countryName) {
  const normalized = normalizeCountryName(countryName);
  const entry = Object.entries(COUNTRY_META).find(
    ([name]) => normalizeCountryName(name) === normalized,
  );

  if (!entry) {
    return {
      code: normalized.slice(0, 2).toUpperCase(),
      deliveryTime: "",
      sortOrder: 99,
    };
  }

  return entry[1];
}

const { client } = await connectPg();

try {
  const orgCheck = await client.query("SELECT id, name FROM public.organizations WHERE id = $1", [
    SCGS_ORG_ID,
  ]);

  if (!orgCheck.rows.length) {
    console.error("No se encontró la org SCGS.");
    process.exit(1);
  }

  const recipientCountries = await client.query(
    `SELECT country, count(*)::int AS recipients
     FROM public.customer_recipients
     WHERE organization_id = $1
     GROUP BY country
     ORDER BY country`,
    [SCGS_ORG_ID],
  );

  if (!recipientCountries.rows.length) {
    console.error("No hay destinatarios. Agrega destinatarios primero.");
    process.exit(1);
  }

  console.log(`Org: ${orgCheck.rows[0].name}`);
  console.log("\nPaíses con destinatarios:");
  for (const row of recipientCountries.rows) {
    console.log(`  - ${row.country}: ${row.recipients} destinatarios`);
  }

  const categoryRow = await client.query(
    `SELECT id, name, tree_data
     FROM public.inventory_categories
     WHERE organization_id = $1
       AND lower(name) = lower($2)
     LIMIT 1`,
    [SCGS_ORG_ID, CATEGORY_NAME],
  );

  if (!categoryRow.rows.length) {
    console.error(`No hay categoría ${CATEGORY_NAME} en inventario.`);
    process.exit(1);
  }

  const inventoryProducts = collectInventoryProducts(categoryRow.rows[0].tree_data);

  if (!inventoryProducts.length) {
    console.error("El inventario no tiene productos en el árbol de cajas.");
    process.exit(1);
  }

  console.log(`\nProductos en inventario: ${inventoryProducts.map((p) => p.name).join(", ")}`);

  await client.query("BEGIN");

  let countriesCreated = 0;
  let boxesInserted = 0;
  let boxesSkipped = 0;

  for (const { country } of recipientCountries.rows) {
    const meta = resolveCountryMeta(country);

    const existingCountry = await client.query(
      `SELECT id, name FROM public.pricing_countries
       WHERE organization_id = $1
         AND (
           code = $2
           OR lower(translate(name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) =
              lower(translate($3, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
         )
       LIMIT 1`,
      [SCGS_ORG_ID, meta.code, country],
    );

    let countryId;

    if (existingCountry.rows.length) {
      countryId = existingCountry.rows[0].id;
      await client.query(
        `UPDATE public.pricing_countries
         SET code = $1, name = $2, delivery_time = $3, sort_order = $4
         WHERE id = $5`,
        [meta.code, country, meta.deliveryTime, meta.sortOrder, countryId],
      );
      console.log(`\nPaís existente: ${country}`);
    } else {
      const inserted = await client.query(
        `INSERT INTO public.pricing_countries (
          organization_id, code, name, delivery_time, sort_order
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [SCGS_ORG_ID, meta.code, country, meta.deliveryTime, meta.sortOrder],
      );
      countryId = inserted.rows[0].id;
      countriesCreated += 1;
      console.log(`\nPaís nuevo: ${country}`);
    }

    for (const product of inventoryProducts) {
      const key = catalogKey(product.name, product.subcategory);
      const defaults = DEFAULT_BOX_PRICES[product.name] || { price: "$40", cost: "$25" };

      const exists = await client.query(
        `SELECT id FROM public.pricing_country_boxes
         WHERE country_id = $1 AND catalog_key = $2`,
        [countryId, key],
      );

      if (exists.rows.length) {
        boxesSkipped += 1;
        console.log(`  Skip: ${product.name} (ya tiene precio)`);
        continue;
      }

      await client.query(
        `INSERT INTO public.pricing_country_boxes (
          organization_id, country_id, size, price, cost, catalog_key
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [SCGS_ORG_ID, countryId, product.name, defaults.price, defaults.cost, key],
      );

      boxesInserted += 1;
      console.log(
        `  OK: ${product.name} → público ${defaults.price}, costo ${defaults.cost}`,
      );
    }
  }

  await client.query("COMMIT");

  const summary = await client.query(
    `SELECT pc.name AS country, pcb.size, pcb.price, pcb.cost
     FROM public.pricing_country_boxes pcb
     JOIN public.pricing_countries pc ON pc.id = pcb.country_id
     WHERE pcb.organization_id = $1
     ORDER BY pc.sort_order, pc.name, pcb.size`,
    [SCGS_ORG_ID],
  );

  console.log("\n--- Resumen ---");
  console.log(`Países nuevos: ${countriesCreated}`);
  console.log(`Productos insertados: ${boxesInserted} (omitidos: ${boxesSkipped})`);
  console.log(`Total filas de precio: ${summary.rows.length}`);
  console.table(summary.rows);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
