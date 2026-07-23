const failures = [];
const origin = String(process.env.APP_ORIGIN || "").trim();
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

if (process.env.NODE_ENV !== "production") {
  failures.push("NODE_ENV debe ser production");
}
if (!origin.startsWith("https://")) {
  failures.push("APP_ORIGIN debe ser un origen HTTPS canonico");
}
if (process.env.ALLOW_PUBLIC_SIGNUP === "1") {
  failures.push("ALLOW_PUBLIC_SIGNUP no puede estar habilitado");
}
if (process.env.DEV_AUTH_BYPASS === "1") {
  failures.push("DEV_AUTH_BYPASS no puede estar habilitado");
}
if (!supabaseUrl.startsWith("https://")) {
  failures.push("NEXT_PUBLIC_SUPABASE_URL debe apuntar al proyecto HTTPS desplegado");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  failures.push("falta SUPABASE_SERVICE_ROLE_KEY");
}
if (process.env.ALLOW_LOCAL_CREDENTIAL_SCRIPTS === "1") {
  failures.push("ALLOW_LOCAL_CREDENTIAL_SCRIPTS no puede estar habilitado");
}

if (failures.length) {
  console.error("SECURITY_RELEASE_BLOCKED");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("SECURITY_RELEASE_ENV_OK");
console.log(
  "Verificacion externa obligatoria: signup deshabilitado, politica de contrasena, refresh rotation, JWT/session limits y MFA administrativo en Supabase Auth.",
);
