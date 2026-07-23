export function readClientIp(headers: Headers): string {
  if (process.env.TRUST_PROXY_HEADERS === "1") {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }

    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }
  }

  return headers.get("x-vercel-id")?.trim() || "direct";
}
