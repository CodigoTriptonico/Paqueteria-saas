/**
 * Borra todos los datos de la app excepto el super-admin (PLATFORM_OWNER_EMAIL).
 * Conserva: catálogo de permisos, usuario auth del dueño, platform_admins, su org Boxario y perfil.
 *
 * Required in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_DB_PASSWORD
 *   PLATFORM_OWNER_EMAIL
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

async function count(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return Number(rows[0]?.count ?? 0);
}

async function cleanKeeperOrgData(client, orgId) {
  await client.query(`delete from public.shipments where organization_id = $1`, [orgId]);
  await client.query(`delete from public.customer_recipients where organization_id = $1`, [orgId]);
  await client.query(`delete from public.activity_history where organization_id = $1`, [orgId]);
  await client.query(`delete from public.customers where organization_id = $1`, [orgId]);
  await client.query(`delete from public.distributor_country_boxes where organization_id = $1`, [orgId]);
  await client.query(`delete from public.distributors where organization_id = $1`, [orgId]);
  await client.query(`delete from public.pricing_country_boxes where organization_id = $1`, [orgId]);
  await client.query(`delete from public.pricing_countries where organization_id = $1`, [orgId]);
  await client.query(`delete from public.organization_route_settings where organization_id = $1`, [orgId]);
  await client.query(`delete from public.organization_invoice_counters where organization_id = $1`, [orgId]);
  await client.query(`delete from public.inventory_movements where organization_id = $1`, [orgId]);
  await client.query(`delete from public.inventory_stock where organization_id = $1`, [orgId]);
  await client.query(`delete from public.inventory_items where organization_id = $1`, [orgId]);
  await client.query(`delete from public.inventory_categories where organization_id = $1`, [orgId]);
  await client.query(
    `
    delete from public.profile_warehouses
    where profile_id in (select id from public.profiles where organization_id = $1)
  `,
    [orgId],
  );
  await client.query(`delete from public.warehouses where organization_id = $1`, [orgId]);
}

async function main() {
  loadEnvLocal();

  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();

  if (!ownerEmail) {
    console.error("Missing PLATFORM_OWNER_EMAIL in .env.local");
    process.exit(1);
  }

  const { client, label } = await connectPg();
  console.log("Connected to", label);

  const { rows: keeperRows } = await client.query(
    `select id, email from auth.users where lower(email) = $1 limit 1`,
    [ownerEmail],
  );

  const keeper = keeperRows[0];

  if (!keeper) {
    console.error("No existe usuario auth con PLATFORM_OWNER_EMAIL:", ownerEmail);
    console.error("Ejecuta: node scripts/restore-platform-owner.mjs");
    process.exit(1);
  }

  const keeperId = keeper.id;

  const { rows: profileRows } = await client.query(
    `select organization_id from public.profiles where id = $1 limit 1`,
    [keeperId],
  );

  const keeperOrgId = profileRows[0]?.organization_id ?? null;

  console.log("Super-usuario:", keeper.email, keeperId);
  console.log("Organización plataforma:", keeperOrgId || "(sin perfil)");

  const before = {
    organizations: await count(client, "select count(*)::int as count from public.organizations"),
    profiles: await count(client, "select count(*)::int as count from public.profiles"),
    authUsers: await count(client, "select count(*)::int as count from auth.users"),
    shipments: await count(client, "select count(*)::int as count from public.shipments"),
    customers: await count(client, "select count(*)::int as count from public.customers"),
    platformAdmins: await count(client, "select count(*)::int as count from public.platform_admins"),
  };

  console.log("Antes:", before);

  await client.query("begin");
  try {
    if (keeperOrgId) {
      await client.query(`delete from public.organizations where id <> $1`, [keeperOrgId]);
      await cleanKeeperOrgData(client, keeperOrgId);
      await client.query(
        `update public.organizations set kind = 'platform', is_active = true where id = $1`,
        [keeperOrgId],
      );
    } else {
      await client.query("delete from public.organizations");
    }

    await client.query(`delete from public.platform_admins where user_id <> $1`, [keeperId]);
    await client.query(
      `insert into public.platform_admins (user_id) values ($1) on conflict (user_id) do nothing`,
      [keeperId],
    );
    await client.query(`delete from auth.users where id <> $1`, [keeperId]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const after = {
    organizations: await count(client, "select count(*)::int as count from public.organizations"),
    profiles: await count(client, "select count(*)::int as count from public.profiles"),
    authUsers: await count(client, "select count(*)::int as count from auth.users"),
    shipments: await count(client, "select count(*)::int as count from public.shipments"),
    customers: await count(client, "select count(*)::int as count from public.customers"),
    platformAdmins: await count(client, "select count(*)::int as count from public.platform_admins"),
    permissions: await count(client, "select count(*)::int as count from public.permissions"),
  };

  console.log("Después:", after);

  if (!keeperOrgId) {
    console.log("\nNo había perfil/org. Ejecuta: npm run db:restore-owner");
  } else {
    console.log("\nDatos borrados. Super-admin conservado:", ownerEmail);
    console.log("Login: /login  |  Panel plataforma: /platform");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
