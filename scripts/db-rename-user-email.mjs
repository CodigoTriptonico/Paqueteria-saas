import { createClient } from "@supabase/supabase-js";
import { connectPg } from "./lib/db-connection.mjs";
import { assertLocalCredentialScript } from "./lib/local-credential-guard.mjs";

assertLocalCredentialScript();

const fromEmail = process.argv[2]?.trim().toLowerCase();
const toEmail = process.argv[3]?.trim().toLowerCase();

if (!fromEmail || !toEmail) {
  throw new Error("Uso: node scripts/db-rename-user-email.mjs <email-actual> <email-nuevo>");
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
  const existingTarget = await client.query(
    `select id from auth.users where lower(email) = $1 limit 1`,
    [toEmail],
  );
  if (existingTarget.rowCount > 0) {
    throw new Error(`Ya existe un usuario con ${toEmail}`);
  }

  const source = await client.query(
    `select id, email from auth.users where lower(email) = $1 limit 1`,
    [fromEmail],
  );
  if (source.rowCount === 0) {
    throw new Error(`No existe usuario con ${fromEmail}`);
  }

  const user = source.rows[0];
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: toEmail,
    email_confirm: true,
  });
  if (error) {
    throw new Error(error.message);
  }

  await client.query(
    `update public.profiles set email = $1 where id = $2`,
    [toEmail, user.id],
  );

  console.log(`Connected to ${label}`);
  console.log(`${fromEmail} -> ${toEmail}`);
} finally {
  await client.end();
}
