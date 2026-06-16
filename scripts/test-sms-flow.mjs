import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    console.error("Missing Supabase configuration in .env.local");
    process.exit(1);
  }

  // Create admin/service-role client
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Create client-side / anon client to trigger OTP
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const testEmail = "test-paqueteria-flow@example.com";
  const testPhone = "+525512345678"; // normalizePhoneE164 for Mexico 10 digits
  const testOrgName = "Test Paqueteria Flow";

  console.log("1. Cleaning up previous test user (if exists)...");
  const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = existingList?.users?.find(
    (u) => u.email?.toLowerCase() === testEmail || u.phone === testPhone
  );

  if (existing) {
    console.log(`Found existing user with ID ${existing.id}. Deleting...`);
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) {
      console.warn("Could not delete existing user:", deleteError.message);
    } else {
      console.log("Existing test user deleted successfully.");
    }
  }

  // Also clean up any organization remnants
  console.log("Cleaning up database org test remnants...");
  const { data: orgs } = await admin.from("organizations").select("id").eq("name", testOrgName);
  for (const org of orgs || []) {
    console.log(`Deleting test organization ID ${org.id}...`);
    await admin.from("profiles").delete().eq("organization_id", org.id);
    await admin.from("organizations").delete().eq("id", org.id);
  }

  console.log("2. Creating new test organization and admin user...");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: "PasswordSuperSecure123!",
    email_confirm: true,
    phone: testPhone,
    phone_confirm: true,
  });

  if (createError || !created.user) {
    console.error("Failed to create test user:", createError?.message || "unknown");
    process.exit(1);
  }

  console.log(`User created in auth with ID ${created.user.id}.`);

  console.log("Bootstrapping organization via RPC...");
  const { data: orgId, error: bootstrapError } = await admin.rpc("bootstrap_organization", {
    org_name: testOrgName,
    owner_id: created.user.id,
    owner_email: testEmail,
    owner_name: "Test Owner Flow",
    org_kind: "client",
    owner_phone: testPhone,
  });

  if (bootstrapError || !orgId) {
    console.error("Failed to bootstrap organization database record:", bootstrapError?.message || "unknown");
    process.exit(1);
  }

  console.log(`Organization bootstrapped successfully with ID ${orgId}.`);

  console.log("\n3. Testing Password Reset OTP trigger (SMS)...");
  console.log(`Triggering OTP to phone: ${testPhone}`);
  const { error: otpError } = await client.auth.signInWithOtp({
    phone: testPhone,
    options: { shouldCreateUser: false },
  });

  if (otpError) {
    console.log("\n[TEST RESULT] FAILURE at SMS trigger!");
    console.log("Error Message:", otpError.message);
  } else {
    console.log("\n[TEST RESULT] SUCCESS! OTP SMS request sent without error.");
    console.log("If your Supabase project has Phone authentication with Twilio configured, the SMS was successfully dispatched.");
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err.message || err);
});
