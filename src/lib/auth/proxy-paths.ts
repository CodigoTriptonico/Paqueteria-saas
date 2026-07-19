import { sanitizeInternalPath } from "@/lib/organizations/kind";

const PUBLIC_PATHS = [
  "/login",
  "/rastrear",
  "/api/auth/sign-in",
  "/api/public/tracking",
] as const;

export function isPublicProxyPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );
}

export function resolveAuthenticatedLoginPath(pathname: string, nextPath: string | null) {
  if (pathname !== "/login") {
    return null;
  }

  return sanitizeInternalPath(nextPath) || "/";
}
