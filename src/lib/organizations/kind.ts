export type OrganizationKind = "platform" | "client";

export const PLATFORM_ORG_NAME = "Boxario";

export function isClientOrganization(kind: string | null | undefined): boolean {
  return kind !== "platform";
}

export function resolvePostLoginRedirect(options: {
  isPlatformAdmin: boolean;
  nextPath?: string | null;
}): string {
  const next = options.nextPath?.trim() || null;
  if (options.isPlatformAdmin && (!next || next === "/" || !next.startsWith("/platform"))) {
    return "/platform";
  }
  return next || "/";
}

export function canDeactivateOrganization(kind: string | null | undefined): boolean {
  return isClientOrganization(kind);
}
