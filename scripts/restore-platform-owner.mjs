/**
 * Recrea el super-admin de plataforma (PLATFORM_OWNER_EMAIL en .env.local).
 *
 * Opcional en .env.local:
 *   PLATFORM_OWNER_PASSWORD=...   (si no está, se genera una temporal)
 *   PLATFORM_OWNER_FULL_NAME=...
 *   PLATFORM_OWNER_ORG_NAME=...   (default: Boxario)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function tempPassword() {
  return `Pm-${randomBytes(9).toString("base64url")}!`;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();

  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  if (!email) {
    console.error("Falta PLATFORM_OWNER_EMAIL en .env.local");
    process.exit(1);
  }

  const password = process.env.PLATFORM_OWNER_PASSWORD?.trim() || tempPassword();
  const generated = !process.env.PLATFORM_OWNER_PASSWORD?.trim();
  const fullName = process.env.PLATFORM_OWNER_FULL_NAME?.trim() || "Pablo Isaza";
  const orgName = process.env.PLATFORM_OWNER_ORG_NAME?.trim() || "Boxario";
  const orgKind = "platform";

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = existingList?.users?.find((u) => u.email?.toLowerCase() === email);

  let userId = existing?.id;

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("No se pudo actualizar el usuario:", error.message);
      process.exit(1);
    }
    console.log("Usuario auth ya existía; contraseña actualizada.");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      console.error("No se pudo crear el usuario:", error?.message || "sin user");
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Usuario auth creado.");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    const { error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: orgName,
      owner_id: userId,
      owner_email: email,
      owner_name: fullName,
      org_slug: null,
      org_kind: orgKind,
      owner_phone: null,
    });
    if (bootstrapError) {
      console.error("bootstrap_organization:", bootstrapError.message);
      process.exit(1);
    }
    console.log("Organización bootstrap:", orgName);
  } else {
    const { error: kindError } = await admin
      .from("organizations")
      .update({ kind: orgKind })
      .eq("id", profile.organization_id);
    if (kindError) {
      console.error("No se pudo marcar org como platform:", kindError.message);
      process.exit(1);
    }
    console.log("Perfil ya existía; org marcada como platform:", profile.organization_id);
  }

  const { error: grantError } = await admin.rpc("grant_platform_admin", {
    target_user_id: userId,
  });
  if (grantError) {
    console.error("grant_platform_admin:", grantError.message);
    process.exit(1);
  }

  const { data: isAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  console.log("\nSuper-admin listo.");
  console.log("  Email:", email);
  console.log("  User ID:", userId);
  console.log("  platform_admins:", isAdmin ? "sí" : "no");
  console.log("  Login: http://localhost:3000/login");
  console.log("  Panel: http://localhost:3000/platform");

  if (generated) {
    console.log("\nContraseña temporal (guárdala o define PLATFORM_OWNER_PASSWORD en .env.local):");
    console.log(password);
  } else {
    console.log("\nContraseña: la de PLATFORM_OWNER_PASSWORD en .env.local");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
