import { createClient } from "@supabase/supabase-js";
import { connectPg } from "./lib/db-connection.mjs";
import {
  assertLocalCredentialScript,
  requireLocalCredential,
} from "./lib/local-credential-guard.mjs";

assertLocalCredentialScript();
const localUserPassword = requireLocalCredential("LOCAL_TEST_USER_PASSWORD");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
}

const admin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  {
    email: "conductor1@scgs.local",
    password: localUserPassword,
    fullName: "Conductor 1",
  },
  {
    email: "conductor2@scgs.local",
    password: localUserPassword,
    fullName: "Conductor 2",
  },
];

async function findAuthUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new Error(error.message);
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      return found;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

async function ensureAuthUser(user) {
  const existing = await findAuthUserByEmail(user.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });

    if (error) {
      throw new Error(error.message);
    }

    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });

  if (error || !data.user) {
    throw new Error(error?.message || `No se pudo crear ${user.email}`);
  }

  return data.user.id;
}

const { client, label } = await connectPg();

try {
  const orgResult = await client.query(`
    select id, name
    from public.organizations
    where kind = 'client'
    order by created_at
    limit 1
  `);

  const org = orgResult.rows[0];
  if (!org) {
    throw new Error("No hay organizacion cliente");
  }

  await client.query("begin");

  await client.query(`
    insert into public.permissions (key, name, description) values
      ('routes.view', 'Ver rutas', 'Ver envios asignados'),
      ('routes.update_status', 'Estado envio', 'Cambiar estado de envios')
    on conflict (key) do nothing
  `);

  const roleResult = await client.query(
    `
      insert into public.roles (organization_id, slug, name, is_system)
      values ($1, 'conductor', 'Conductor', true)
      on conflict (organization_id, slug)
      do update set name = excluded.name, is_system = true
      returning id
    `,
    [org.id],
  );

  const roleId = roleResult.rows[0].id;

  await client.query(
    `
      insert into public.role_permissions (role_id, permission_id, granted)
      select $1, id, true
      from public.permissions
      where key in ('routes.view', 'routes.update_status')
      on conflict (role_id, permission_id)
      do update set granted = excluded.granted
    `,
    [roleId],
  );

  for (const user of users) {
    const authUserId = await ensureAuthUser(user);

    await client.query(
      `
        insert into public.profiles (id, organization_id, email, full_name, role_id, is_active)
        values ($1, $2, $3, $4, $5, true)
        on conflict (id)
        do update set
          organization_id = excluded.organization_id,
          email = excluded.email,
          full_name = excluded.full_name,
          role_id = excluded.role_id,
          is_active = true
      `,
      [authUserId, org.id, user.email, user.fullName, roleId],
    );
  }

  await client.query("commit");

  console.log(`Connected to ${label}`);
  console.log(`Organizacion: ${org.name}`);
  console.log("Rol: conductor");
  for (const user of users) {
    console.log(`Usuario: ${user.email} (credencial local configurada; existentes sin cambio)`);
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
