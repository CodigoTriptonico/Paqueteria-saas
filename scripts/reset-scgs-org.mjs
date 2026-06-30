/**
 * Borra todos los datos operativos de la org SCGS y la deja como recién creada.
 * Conserva: organización, roles del sistema, perfil administrador y su usuario auth.
 *
 * Uso: node scripts/reset-scgs-org.mjs
 */
import { connectPg } from "./lib/db-connection.mjs";

const SCGS_ORG_ID = process.env.SCGS_ORG_ID || "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

async function count(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return Number(rows[0]?.count ?? 0);
}

async function wipeOrgOperationalData(client, orgId) {
  const tables = [
    "shipments",
    "customer_recipients",
    "customers",
    "activity_history",
    "inventory_assignments",
    "inventory_movements",
    "inventory_stock",
    "inventory_items",
    "inventory_categories",
    "distributor_country_boxes",
    "distributors",
    "pricing_promotions",
    "pricing_country_boxes",
    "pricing_countries",
    "organization_route_settings",
    "organization_invoice_counters",
  ];

  for (const table of tables) {
    const result = await client.query(
      `delete from public.${table} where organization_id = $1`,
      [orgId],
    );
    console.log(`  ${table}: ${result.rowCount}`);
  }

  await client.query(
    `
    delete from public.profile_warehouses
    where profile_id in (select id from public.profiles where organization_id = $1)
    `,
    [orgId],
  );

  await client.query(`delete from public.warehouses where organization_id = $1`, [orgId]);

  const { rows: customRoles } = await client.query(
    `
    select id, slug
    from public.roles
    where organization_id = $1 and is_system = false
    `,
    [orgId],
  );

  for (const role of customRoles) {
    await client.query(`delete from public.role_permissions where role_id = $1`, [role.id]);
    await client.query(`delete from public.roles where id = $1`, [role.id]);
    console.log(`  custom role removed: ${role.slug}`);
  }

  await client.query(
    `
    update public.organizations
    set settings = '{"multi_warehouse_enabled": false}'::jsonb
    where id = $1
    `,
    [orgId],
  );
}

async function ensureDefaultWarehouse(client, orgId, adminProfileId) {
  const { rows } = await client.query(
    `
    insert into public.warehouses (organization_id, name, code, is_default, is_active)
    values ($1, 'Bodega principal', 'MAIN', true, true)
    returning id
    `,
    [orgId],
  );

  const warehouseId = rows[0].id;

  await client.query(
    `
    insert into public.profile_warehouses (profile_id, warehouse_id)
    values ($1, $2)
    on conflict do nothing
    `,
    [adminProfileId, warehouseId],
  );

  await client.query(
    `
    update public.profiles
    set default_warehouse_id = $2
    where id = $1
    `,
    [adminProfileId, warehouseId],
  );

  return warehouseId;
}

async function main() {
  const { client } = await connectPg();

  try {
    const { rows: orgRows } = await client.query(
      `select id, name, slug from public.organizations where id = $1`,
      [SCGS_ORG_ID],
    );

    if (!orgRows.length) {
      console.error("No se encontró la org SCGS:", SCGS_ORG_ID);
      process.exit(1);
    }

    const org = orgRows[0];

    const { rows: adminRows } = await client.query(
      `
      select p.id, p.email, p.full_name
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.organization_id = $1 and r.slug = 'administrador'
      order by p.created_at asc
      limit 1
      `,
      [SCGS_ORG_ID],
    );

    if (!adminRows.length) {
      console.error("No hay administrador en la org SCGS.");
      process.exit(1);
    }

    const admin = adminRows[0];

    const before = {
      customers: await count(
        client,
        "select count(*)::int as count from public.customers where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      recipients: await count(
        client,
        "select count(*)::int as count from public.customer_recipients where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      shipments: await count(
        client,
        "select count(*)::int as count from public.shipments where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      items: await count(
        client,
        "select count(*)::int as count from public.inventory_items where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      profiles: await count(
        client,
        "select count(*)::int as count from public.profiles where organization_id = $1",
        [SCGS_ORG_ID],
      ),
    };

    console.log(`Reseteando ${org.name} (${org.slug})`);
    console.log("Administrador conservado:", admin.email, admin.full_name);
    console.log("Antes:", before);

    const { rows: otherProfiles } = await client.query(
      `
      select id, email
      from public.profiles
      where organization_id = $1 and id <> $2
      `,
      [SCGS_ORG_ID, admin.id],
    );

    await client.query("begin");

    await wipeOrgOperationalData(client, SCGS_ORG_ID);

    for (const profile of otherProfiles) {
      await client.query(`delete from public.profile_warehouses where profile_id = $1`, [
        profile.id,
      ]);
      await client.query(`delete from public.profiles where id = $1`, [profile.id]);
      await client.query(`delete from auth.users where id = $1`, [profile.id]);
      console.log(`  usuario eliminado: ${profile.email}`);
    }

    const warehouseId = await ensureDefaultWarehouse(client, SCGS_ORG_ID, admin.id);

    await client.query("commit");

    const after = {
      customers: await count(
        client,
        "select count(*)::int as count from public.customers where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      recipients: await count(
        client,
        "select count(*)::int as count from public.customer_recipients where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      shipments: await count(
        client,
        "select count(*)::int as count from public.shipments where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      items: await count(
        client,
        "select count(*)::int as count from public.inventory_items where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      profiles: await count(
        client,
        "select count(*)::int as count from public.profiles where organization_id = $1",
        [SCGS_ORG_ID],
      ),
      warehouses: await count(
        client,
        "select count(*)::int as count from public.warehouses where organization_id = $1",
        [SCGS_ORG_ID],
      ),
    };

    console.log("\nDespués:", after);
    console.log("Bodega principal:", warehouseId);
    console.log("\nSCGS quedó limpia. Solo el administrador:", admin.email);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
