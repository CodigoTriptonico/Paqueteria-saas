/** Dominios frecuentes al completar correos (Latam + globales). */
export const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "proton.me",
  "aol.com",
  "mail.com",
  "hotmail.es",
  "outlook.es",
  "yahoo.es",
] as const;

export function splitEmailAt(value: string): {
  localPart: string;
  domainPart: string;
  hasAt: boolean;
} {
  const at = value.indexOf("@");
  if (at === -1) {
    return { localPart: value, domainPart: "", hasAt: false };
  }
  return {
    localPart: value.slice(0, at),
    domainPart: value.slice(at + 1),
    hasAt: true,
  };
}

/** Correos completos sugeridos a partir del valor actual del campo. */
export function getEmailDomainSuggestions(value: string, limit = 8): string[] {
  const { localPart, domainPart, hasAt } = splitEmailAt(value);
  if (!hasAt || !localPart.trim()) {
    return [];
  }

  const query = domainPart.toLowerCase();
  const matches = COMMON_EMAIL_DOMAINS.filter((domain) =>
    query ? domain.startsWith(query) : true,
  );

  const normalized = value.trim().toLowerCase();

  return matches
    .slice(0, limit)
    .map((domain) => `${localPart}@${domain}`)
    .filter((suggestion) => suggestion.trim().toLowerCase() !== normalized);
}
