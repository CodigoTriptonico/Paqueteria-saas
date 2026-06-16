import { PLATFORM_ORG_NAME } from "@/lib/organizations/kind";

export function getPlatformOwnerEmail(): string | null {
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function isPlatformOwnerEmail(email: string): boolean {
  const ownerEmail = getPlatformOwnerEmail();
  if (!ownerEmail) {
    return false;
  }
  return ownerEmail === email.trim().toLowerCase();
}

export function platformOwnerOrganizationName(): string {
  return PLATFORM_ORG_NAME;
}
