export type OrganizationBranding = {
  name: string;
  shortName: string | null;
  brandTitle: string;
  logoUrl: string | null;
};

export const PLATFORM_BRAND_TITLE = "Boxario";
export const ORGANIZATION_LOGO_BUCKET = "organization-logos";

export function resolveOrganizationBrandTitle(
  name: string,
  shortName?: string | null,
  fallback = PLATFORM_BRAND_TITLE,
): string {
  const acronym = shortName?.trim();
  if (acronym) {
    return acronym;
  }

  const fullName = name.trim();
  if (fullName) {
    return fullName;
  }

  return fallback;
}

export function organizationBrandInitials(brandTitle: string): string {
  const parts = brandTitle.trim().split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

export function resolveOrganizationBranding(input: {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
}): OrganizationBranding {
  const name = input.name.trim() || PLATFORM_BRAND_TITLE;
  const shortName = input.shortName?.trim() || null;

  return {
    name,
    shortName,
    brandTitle: resolveOrganizationBrandTitle(name, shortName),
    logoUrl: input.logoUrl ?? null,
  };
}

export function resolveOrganizationBrandingFromSession(session: {
  organizationName: string;
  organizationShortName?: string | null;
  organizationLogoUrl?: string | null;
}): OrganizationBranding {
  return resolveOrganizationBranding({
    name: session.organizationName,
    shortName: session.organizationShortName,
    logoUrl: session.organizationLogoUrl,
  });
}
