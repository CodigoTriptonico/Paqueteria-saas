import { loadEnvLocal } from "./lib/db-connection.mjs";

const BASE = process.env.APP_BASE_URL || "http://localhost:3000";
const LOCAL_CANONICAL_PASSWORD = "123456789";

function parseSetCookie(header) {
  const cookies = new Map();
  if (!header) {
    return cookies;
  }

  const parts = Array.isArray(header) ? header : [header];
  for (const part of parts) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) {
      continue;
    }
    cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return cookies;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function mergeCookies(jar, header) {
  for (const [name, value] of parseSetCookie(header)) {
    jar[name] = value;
  }
}

async function fetchWithJar(path, jar, init = {}) {
  const headers = new Headers(init.headers || {});
  const existing = cookieHeader(jar);
  if (existing) {
    headers.set("cookie", existing);
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  if (setCookies.length) {
    for (const line of setCookies) {
      mergeCookies(jar, line);
    }
  } else {
    const single = response.headers.get("set-cookie");
    if (single) {
      mergeCookies(jar, single);
    }
  }

  return response;
}

async function ownerPassword() {
  return process.env.PLATFORM_OWNER_PASSWORD?.trim() || LOCAL_CANONICAL_PASSWORD;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerEmail =
    process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || "pablo.isaza.i@gmail.com";

  if (!url || !serviceKey) {
    console.error("Falta configuración Supabase en .env.local");
    process.exit(1);
  }

  const password = await ownerPassword();
  const jar = {};

  console.log("1. Login vía API…");
  const signIn = await fetchWithJar("/api/auth/sign-in", jar, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ownerEmail, password }),
  });

  if (signIn.status !== 200) {
    const body = await signIn.text();
    console.error(`Sign-in falló (${signIn.status}):`, body);
    process.exit(1);
  }

  const signInJson = await signIn.json();
  if (!signInJson.ok || !signInJson.redirectTo) {
    console.error("Respuesta de sign-in inválida:", signInJson);
    process.exit(1);
  }

  const cookieNames = Object.keys(jar);
  console.log(`   OK → ${signInJson.redirectTo} | cookies: ${cookieNames.join(", ") || "(ninguna)"}`);

  if (!cookieNames.some((name) => name.startsWith("sb-"))) {
    console.error("No se recibieron cookies de sesión en sign-in");
    process.exit(1);
  }

  console.log("2. GET /platform…");
  const platform = await fetchWithJar("/platform", jar);
  if (platform.status !== 200) {
    console.error(`Esperaba 200 en /platform, recibí ${platform.status}`);
    process.exit(1);
  }
  console.log("   OK");

  console.log("3. GET /configuracion (debe ir a /platform, no /login)…");
  const config = await fetchWithJar("/configuracion", jar);
  const location = config.headers.get("location") || "";
  if (config.status >= 300 && config.status < 400 && location.includes("/login")) {
    console.error(`Redirigió a login: ${location}`);
    process.exit(1);
  }
  if (config.status >= 300 && config.status < 400 && location.includes("/platform")) {
    console.log(`   OK → redirect ${location}`);
  } else if (config.status === 200) {
    const body = await config.text();
    if (body.includes("/platform")) {
      console.log("   OK → redirect RSC a /platform");
    } else {
      console.error("Esperaba bloqueo sin cliente; recibí 200 sin redirect a /platform");
      process.exit(1);
    }
  } else {
    console.log(`   status=${config.status} location=${location || "(none)"}`);
  }

  console.log("\nFlujo de auth platform admin: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
