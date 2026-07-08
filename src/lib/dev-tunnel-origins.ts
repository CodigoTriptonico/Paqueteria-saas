export const TUNNEL_DEV_ORIGIN_WILDCARD = "*.trycloudflare.com";

const DEFAULT_DEV_ORIGINS = ["127.0.0.1", "localhost", TUNNEL_DEV_ORIGIN_WILDCARD];

export function resolveDevTunnelOrigins(options?: {
  baseOrigins?: string[];
  tunnelUrl?: string | null;
}): string[] {
  const origins = new Set(options?.baseOrigins ?? DEFAULT_DEV_ORIGINS);
  const tunnelUrl = options?.tunnelUrl?.trim();

  if (tunnelUrl) {
    try {
      origins.add(new URL(tunnelUrl).hostname);
    } catch {
      // ignore invalid tunnel url
    }
  }

  return [...origins];
}
