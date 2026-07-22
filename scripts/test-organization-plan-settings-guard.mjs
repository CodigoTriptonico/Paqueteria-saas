/**
 * Verifies organizations.settings plan keys stay locked for tenant admins
 * and remain writable for platform admin / service_role / postgres.
 */
import assert from "node:assert/strict";
import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log(`Testing organization plan settings guard on ${label}`);

async function asRole(role, jwtClaims, task) {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    if (jwtClaims) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(jwtClaims),
      ]);
    }
    const result = await task();
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

const trigger = await client.query(`
  select 1
  from pg_trigger
  where tgname = 'organizations_protect_plan_settings'
  limit 1
`);
assert.equal(trigger.rowCount, 1, "organizations_protect_plan_settings trigger must exist");

const org = await client.query(`
  select organization.id, profile.id as admin_user_id, organization.settings
  from public.organizations organization
  join public.profiles profile on profile.organization_id = organization.id
  join public.roles role on role.id = profile.role_id and role.slug = 'administrador'
  where organization.kind = 'client'
  order by organization.created_at
  limit 1
`);
assert.equal(org.rowCount, 1, "client organization administrator required");
const target = org.rows[0];
const originalSettings = target.settings || {};

const platform = await client.query(`
  select user_id from public.platform_admins limit 1
`);
assert.equal(platform.rowCount, 1, "platform administrator required");

const baselineSettings = {
  ...originalSettings,
  max_users: 4,
  max_warehouses: 2,
  agencies_enabled: false,
  company_short_name: "GUARD-BASE",
};

await client.query(`update public.organizations set settings = $1::jsonb where id = $2`, [
  JSON.stringify(baselineSettings),
  target.id,
]);

const confirmed = await client.query(`select settings from public.organizations where id = $1`, [
  target.id,
]);
assert.equal(confirmed.rows[0].settings.max_users, 4, "baseline max_users must stick for postgres");
assert.equal(confirmed.rows[0].settings.max_warehouses, 2, "baseline max_warehouses must stick for postgres");

await asRole("authenticated", { sub: target.admin_user_id, role: "authenticated" }, async () => {
  await client.query(
    `
    update public.organizations
    set settings = coalesce(settings, '{}'::jsonb)
      || '{"max_users": 500, "max_warehouses": 99, "agencies_enabled": true, "company_short_name": "HACKED"}'::jsonb
    where id = $1
  `,
    [target.id],
  );

  const after = await client.query(`select settings from public.organizations where id = $1`, [
    target.id,
  ]);
  const settings = after.rows[0].settings;
  assert.equal(settings.max_users, 4, "tenant admin must not raise max_users");
  assert.equal(settings.max_warehouses, 2, "tenant admin must not raise max_warehouses");
  assert.equal(settings.agencies_enabled, false, "tenant admin must not enable agencies");
  assert.equal(settings.company_short_name, "HACKED", "non-plan settings remain editable");
});

await asRole("authenticated", { sub: target.admin_user_id, role: "authenticated" }, async () => {
  await client.query(
    `
    update public.organizations
    set settings = coalesce(settings, '{}'::jsonb)
      || $2::jsonb
    where id = $1
  `,
    [
      target.id,
      JSON.stringify({
        company_logo_path: "00000000-0000-4000-8000-000000000099/secret.webp",
      }),
    ],
  );

  const after = await client.query(`select settings from public.organizations where id = $1`, [
    target.id,
  ]);
  assert.notEqual(
    after.rows[0].settings.company_logo_path,
    "00000000-0000-4000-8000-000000000099/secret.webp",
    "tenant admin must not point logo at another org folder",
  );
});

await asRole("authenticated", { sub: target.admin_user_id, role: "authenticated" }, async () => {
  const ownedLogo = `${target.id}/logo.webp`;
  await client.query(
    `
    update public.organizations
    set settings = coalesce(settings, '{}'::jsonb)
      || $2::jsonb
    where id = $1
  `,
    [target.id, JSON.stringify({ company_logo_path: ownedLogo })],
  );

  const after = await client.query(`select settings from public.organizations where id = $1`, [
    target.id,
  ]);
  assert.equal(
    after.rows[0].settings.company_logo_path,
    ownedLogo,
    "tenant admin may set logo path under their own organization id",
  );
});

await asRole("authenticated", { sub: platform.rows[0].user_id, role: "authenticated" }, async () => {
  await client.query(
    `
    update public.organizations
    set settings = coalesce(settings, '{}'::jsonb)
      || '{"max_users": 12, "agencies_enabled": true}'::jsonb
    where id = $1
  `,
    [target.id],
  );

  const after = await client.query(`select settings from public.organizations where id = $1`, [
    target.id,
  ]);
  const settings = after.rows[0].settings;
  assert.equal(settings.max_users, 12, "platform admin may change max_users");
  assert.equal(settings.agencies_enabled, true, "platform admin may enable agencies");
});

await client.query(
  `
  update public.organizations
  set settings = coalesce(settings, '{}'::jsonb) || '{"max_warehouses": 7}'::jsonb
  where id = $1
`,
  [target.id],
);
const serviceRoleAfter = await client.query(
  `select settings->>'max_warehouses' as max_warehouses from public.organizations where id = $1`,
  [target.id],
);
assert.equal(
  serviceRoleAfter.rows[0].max_warehouses,
  "7",
  "postgres/service maintenance may change max_warehouses",
);

await client.query(`update public.organizations set settings = $1::jsonb where id = $2`, [
  JSON.stringify(originalSettings),
  target.id,
]);

await client.end();
console.log("organization plan settings guard OK");
