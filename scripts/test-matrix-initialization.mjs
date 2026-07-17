/**
 * Exercises the full new-company matrix initialization path without retaining
 * any database changes. It builds a synthetic local company around an existing
 * platform identity, then rolls the entire fixture back.
 */
import assert from "node:assert/strict";
import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
let transactionOpen = false;

try {
  await client.query("begin");
  transactionOpen = true;

  const { rows: owners } = await client.query(`
    select profile.id
    from public.profiles as profile
    where not exists (
      select 1
      from public.organization_memberships as membership
      where membership.user_id = profile.id
        and membership.status = 'active'
        and membership.ended_at is null
    )
    order by profile.created_at
    limit 1
    for update
  `);
  const ownerId = owners[0]?.id;
  assert.ok(
    ownerId,
    "Se necesita un perfil local sin membresía activa para probar el flujo completo.",
  );

  const { rows: organizations } = await client.query(`
    insert into public.organizations (name, slug, kind, is_active)
    values ('Prueba de inicialización', 'matrix-init-test-' || left(gen_random_uuid()::text, 8), 'client', true)
    returning id
  `);
  const organizationId = organizations[0].id;
  const { rows: roles } = await client.query(
    `
      insert into public.roles (organization_id, slug, name, is_system)
      values ($1, 'administrador', 'Administrador', true)
      returning id
    `,
    [organizationId],
  );
  await client.query(
    "update public.profiles set organization_id = $1, role_id = $2 where id = $3",
    [organizationId, roles[0].id, ownerId],
  );

  const { rows: initialized } = await client.query(
    "select public.initialize_business_matrix_organization($1) as tenant_id",
    [organizationId],
  );
  assert.equal(initialized[0]?.tenant_id, organizationId);

  const [{ count: activeProfiles }, { count: activeMemberships }] = await Promise.all([
    client.query(
      `
        select count(*)::int as count
        from public.profiles
        where organization_id = $1 and is_active = true and archived_at is null
      `,
      [organizationId],
    ).then(({ rows }) => rows[0]),
    client.query(
      `
        select count(*)::int as count
        from public.organization_memberships
        where organization_id = $1 and status = 'active' and ended_at is null
      `,
      [organizationId],
    ).then(({ rows }) => rows[0]),
  ]);
  assert.equal(activeMemberships, activeProfiles);

  console.log(
    JSON.stringify(
      {
        connection: label,
        organizationId,
        initializedTenantId: initialized[0].tenant_id,
        activeProfiles,
        activeMemberships,
        persistedChanges: false,
      },
      null,
      2,
    ),
  );
} finally {
  if (transactionOpen) {
    await client.query("rollback");
  }
  await client.end();
}
