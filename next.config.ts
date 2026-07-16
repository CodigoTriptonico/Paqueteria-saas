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
  allowedDevOrigins: resolveDevTunnelOrigins({
    tunnelUrl: loadTunnelUrlFromFile(),
  }),
  async headers() {
    return [
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
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/envios/historial",
        destination: "/seguimiento/historial",
        permanent: true,
      },
      {
        source: "/envios",
        destination: "/seguimiento",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
