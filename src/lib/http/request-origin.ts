import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

function parseHostHeader(hostHeader: string | null): { hostname: string; port?: string } | null {
  if (!hostHeader) {
    return null;
  }

  const host = hostHeader.split(",")[0]?.trim();
  if (!host) {
    return null;
  }

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end === -1) {
      return null;
    }
    const hostname = host.slice(1, end);
    const port = host.includes("]:") ? host.split("]:")[1] : undefined;
    return { hostname, port };
  }

  const [hostname, port] = host.split(":");
  if (!hostname) {
    return null;
  }

  return { hostname, port };
}

function readTunnelUrlFromFile(): string | null {
  try {
    const file = resolve(process.cwd(), ".dev-tunnel.url");
    if (!existsSync(file)) {
      return null;
    }

    return readFileSync(file, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function originFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function configuredOrigins(options?: { tunnelUrl?: string | null; readTunnelFile?: boolean }) {
  return [
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_ORIGIN,
    options?.tunnelUrl,
    process.env.DEV_TUNNEL_URL,
    options?.readTunnelFile === false ? null : readTunnelUrlFromFile(),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(originFromUrl)
    .filter((value): value is string => Boolean(value));
}

function resolveForwardedOrigin(headers: Headers, allowedOrigins: string[]): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== "1") {
    return null;
  }
  const forwardedHost = parseHostHeader(headers.get("x-forwarded-host"));
  const host = forwardedHost ?? parseHostHeader(headers.get("host"));

  if (!host || isLocalHostname(host.hostname)) {
    return null;
  }

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    (host.hostname.endsWith(".trycloudflare.com") ? "https" : "http");
  const portSuffix = host.port ? `:${host.port}` : "";

  const candidate = `${proto}://${host.hostname}${portSuffix}`;
  return allowedOrigins.includes(candidate) ? candidate : null;
}

export function resolveRequestOrigin(
  request: Request,
  options?: { tunnelUrl?: string | null; readTunnelFile?: boolean },
): string {
  const allowedOrigins = configuredOrigins(options);
  const configuredOrigin = allowedOrigins[0];
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedOrigin = resolveForwardedOrigin(request.headers, allowedOrigins);
  if (forwardedOrigin) {
    return forwardedOrigin;
  }

  const requestOrigin = new URL(request.url).origin;
  return isLocalHostname(new URL(requestOrigin).hostname) ? requestOrigin : "http://localhost";
}

export function resolveRequestUrl(
  request: Request,
  pathname: string,
  options?: { tunnelUrl?: string | null; readTunnelFile?: boolean },
): URL {
  return new URL(pathname, resolveRequestOrigin(request, options));
}
