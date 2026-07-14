

export function isClientOrganization(kind: string | null | undefined): boolean {
  return kind !== "platform";
}

export function sanitizeInternalPath(path?: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  if (/^https?:/i.test(trimmed)) {
    return null;
  }

  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    return null;
  }

  return trimmed;
}

export function resolvePostLoginRedirect(options: {
  isPlatformAdmin: boolean;
  nextPath?: string | null;
}): string {
  const next = sanitizeInternalPath(options.nextPath);
  if (options.isPlatformAdmin && (!next || next === "/" || !next.startsWith("/platform"))) {
    return "/platform";
  }
  return next || "/";
}

export function canDeactivateOrganization(kind: string | null | undefined): boolean {
  return isClientOrganization(kind);
}
