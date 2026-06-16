import { connectPg } from "./lib/db-connection.mjs";

const { client, label } = await connectPg();
console.log("Connected to", label);

const { rows } = await client.query(`
  select
    p.email,
    p.full_name,
    p.phone,
    p.is_active,
    o.name as organization,
    o.kind as org_kind,
    r.slug as role,
    (pa.user_id is not null) as is_platform_admin,
    p.created_at
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  join public.roles r on r.id = p.role_id
  left join public.platform_admins pa on pa.user_id = p.id
  order by o.kind desc, p.email
`);

for (const row of rows) {
  console.log(
    [
      row.email,
      row.full_name || "(sin nombre)",
      row.organization,
      row.org_kind,
      row.role,
      row.is_platform_admin ? "platform-admin" : "",
      row.is_active ? "activo" : "inactivo",
      row.phone || "(sin teléfono)",
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

console.log(`\nTotal: ${rows.length} usuario(s)`);

await client.end();
