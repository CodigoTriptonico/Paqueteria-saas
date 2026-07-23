import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { assertLocalCredentialScript } from "./lib/local-credential-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local in project root");
    process.exit(1);
  }
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

async function removeTestData(admin, testEmail, testPhone, testOrgName) {
  const { data: orgs } = await admin.from("organizations").select("id").eq("name", testOrgName);
  for (const org of orgs || []) {
    await admin.from("profiles").delete().eq("organization_id", org.id);
    await admin.from("organizations").delete().eq("id", org.id);
  }

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of users?.users || []) {
    if (user.email?.toLowerCase() === testEmail || user.phone === testPhone) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw new Error(`No se pudo limpiar el usuario temporal: ${error.message}`);
    }
  }
}

async function main() {
  loadEnvLocal();
  assertLocalCredentialScript();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    throw new Error("Falta configuración de Supabase local en .env.local");
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const testEmail = "test-paqueteria-flow@example.com";
  const testPhone = "+525512345678";
  const testOrgName = "Test Paqueteria Flow";

  console.log("1. Limpiando datos temporales anteriores...");
  await removeTestData(admin, testEmail, testPhone, testOrgName);

  try {
    console.log("2. Creando organización y usuario temporales...");
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      phone: testPhone,
      phone_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(createError?.message || "No se pudo crear el usuario temporal");
    }

    const { data: orgId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
      org_name: testOrgName,
      owner_id: created.user.id,
      owner_email: testEmail,
      owner_name: "Test Owner Flow",
      org_kind: "client",
      owner_phone: testPhone,
    });
    if (bootstrapError || !orgId) {
      throw new Error(bootstrapError?.message || "No se pudo crear la organización temporal");
    }

    console.log("3. Solicitando OTP por SMS...");
    const { error: otpError } = await client.auth.signInWithOtp({
      phone: testPhone,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      if (
        otpError.message === "Unsupported phone provider"
        && process.env.REQUIRE_SMS_PROVIDER !== "1"
      ) {
        console.log("Flujo SMS: SKIPPED (proveedor telefónico local no configurado)");
        return;
      }
      throw new Error(`Fallo al solicitar el OTP: ${otpError.message}`);
    }
    console.log("Flujo SMS: OK");
  } finally {
    console.log("4. Eliminando usuario y organización temporales...");
    await removeTestData(admin, testEmail, testPhone, testOrgName);
  }
}

main().catch((error) => {
  console.error("Flujo SMS falló:", error.message || error);
  process.exitCode = 1;
});
