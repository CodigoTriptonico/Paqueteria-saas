import { createClient } from "@supabase/supabase-js";
import { connectPg, loadEnvLocal, assertLocalSupabaseUrl } from "./lib/db-connection.mjs";

loadEnvLocal();
assertLocalSupabaseUrl();

const password = process.argv[2];
if (!password) {
  throw new Error("Uso: npm run db:reset-passwords -- <nueva-password>");
}

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

const { client, label } = await connectPg();

try {
  const { rows } = await client.query(`
    select
      au.id,
      au.email
    from auth.users au
    join public.profiles p on p.id = au.id
    order by au.email
  `);

  console.log(`Connected to ${label}`);

  for (const user of rows) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`${user.email}: ${error.message}`);
    }

    console.log(`${user.email} -> password updated`);
  }

  console.log(`\nTotal: ${rows.length} usuario(s) actualizados`);
} finally {
  await client.end();
}
