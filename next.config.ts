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
