/**
 * Deja solo los roles operativos: administrador, conductor, vendedor, logistica.
 *
 * Uso: node scripts/prune-scgs-roles.mjs
 * Opcional: SCGS_ORG_ID=<uuid>
 */
import { connectPg, loadEnvLocal } from "./lib/db-connection.mjs";

const KEEP_SLUGS = ["administrador", "conductor", "vendedor", "logistica"];
const FALLBACK_ORG_ID = "2029bf0c-e766-4840-9d90-f4b252cc3fe9";

async function resolveOrg(client) {
  const envId = process.env.SCGS_ORG_ID?.trim() || FALLBACK_ORG_ID;
  let { rows } = await client.query(
    `select id, name, slug from public.organizations where id = $1`,
    [envId],
  );

  if (!rows.length) {
    ({ rows } = await client.query(
      `select id, name, slug from public.organizations where lower(slug) = 'scgs' limit 1`,
    ));
  }

  return rows[0] || null;
}

async function main() {
  loadEnvLocal();
  const { client, label } = await connectPg();
  console.log("Conectado a", label);

  const org = await resolveOrg(client);
  if (!org) {
    console.error("No se encontró la org SCGS");
    process.exit(1);
  }

  console.log(`\nOrg: ${org.name} (${org.slug}) ${org.id}`);
  console.log("Conservar:", KEEP_SLUGS.join(", "));

  const { rows: before } = await client.query(
    `
    select slug, name
    from public.roles
    where organization_id = $1
    order by name
    `,
    [org.id],
  );
  console.log(
    "Antes:",
    before.map((row) => row.slug).join(", ") || "(ninguno)",
  );

  await client.query("begin");
  try {
    const { rows: toDelete } = await client.query(
      `
      select id, slug, name
      from public.roles
      where organization_id = $1
        and slug <> all($2::text[])
      order by name
      `,
      [org.id, KEEP_SLUGS],
    );

    if (!toDelete.length) {
      console.log("Nada que borrar.");
      await client.query("commit");
      return;
    }

    const roleIds = toDelete.map((row) => row.id);

    const { rows: blockedProfiles } = await client.query(
      `
      select p.id, p.full_name, u.email, r.slug
      from public.profiles p
      left join auth.users u on u.id = p.id
      join public.roles r on r.id = p.role_id
      where p.role_id = any($1::uuid[])
      `,
      [roleIds],
    );

    if (blockedProfiles.length) {
      throw new Error(
        `Hay usuarios usando roles a borrar: ${blockedProfiles
          .map((row) => `${row.email || row.full_name} (${row.slug})`)
          .join(", ")}`,
      );
    }

    const { rows: blockedMemberships } = await client.query(
      `
      select id, user_id, role_id
      from public.organization_memberships
      where role_id = any($1::uuid[])
      `,
      [roleIds],
    );

    if (blockedMemberships.length) {
      throw new Error(
        `Hay memberships usando roles a borrar (${blockedMemberships.length}).`,
      );
    }

    const perms = await client.query(
      `delete from public.role_permissions where role_id = any($1::uuid[])`,
      [roleIds],
    );
    const roles = await client.query(
      `delete from public.roles where id = any($1::uuid[])`,
      [roleIds],
    );

    console.log(
      "Borrados:",
      toDelete.map((row) => row.slug).join(", "),
    );
    console.log(`  role_permissions: ${perms.rowCount ?? 0}`);
    console.log(`  roles: ${roles.rowCount ?? 0}`);

    // Asegura que existan los 4 roles base.
    for (const [slug, name] of [
      ["administrador", "Administrador"],
      ["conductor", "Conductor"],
      ["vendedor", "Vendedor"],
      ["logistica", "Logística"],
    ]) {
      await client.query(
        `
        insert into public.roles (organization_id, slug, name, is_system)
        values ($1, $2, $3, true)
        on conflict (organization_id, slug) do update
          set name = excluded.name,
              is_system = true
        `,
        [org.id, slug, name],
      );
    }

    const { rows: after } = await client.query(
      `
      select slug, name
      from public.roles
      where organization_id = $1
      order by name
      `,
      [org.id],
    );
    console.log(
      "Después:",
      after.map((row) => `${row.name} (${row.slug})`).join(", "),
    );

    await client.query("commit");
    console.log("\nListo.");
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
