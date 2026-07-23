import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import { resolveDevTunnelOrigins } from "./src/lib/dev-tunnel-origins";

function loadTunnelUrlFromFile(): string | null {
  const urlFile = resolve(__dirname, ".dev-tunnel.url");
  if (!existsSync(urlFile)) {
    return null;
  }

  return readFileSync(urlFile, "utf8").trim() || null;
}

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "10mb",
  },
  allowedDevOrigins: resolveDevTunnelOrigins({
    tunnelUrl: loadTunnelUrlFromFile(),
  }),
  async headers() {
    const productionCsp = process.env.NODE_ENV === "production";
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      productionCsp
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), geolocation=(self), microphone=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      {
        key: productionCsp
          ? "Content-Security-Policy"
          : "Content-Security-Policy-Report-Only",
        value: contentSecurityPolicy,
      },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
    ];
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/api/conductor/task-results",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/envios/historial",
        destination: "/seguimiento?view=history",
        permanent: true,
      },
      {
        source: "/envios",
        destination: "/seguimiento",
        permanent: true,
      },
      {
        source: "/distribuidores",
        destination: "/agencias",
        permanent: true,
      },
      {
        source: "/distribuidor",
        destination: "/agencia",
        permanent: true,
      },
      {
        source: "/mis-distribuidores",
        destination: "/captacion",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
