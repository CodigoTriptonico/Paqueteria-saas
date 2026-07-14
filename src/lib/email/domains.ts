/** Dominios frecuentes al completar correos (Latam + globales). */
const COMMON_EMAIL_DOMAINS = [
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

function splitEmailAt(value: string): {
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

/** Quita @ duplicados después del primero. */
export function normalizeEmailInputValue(value: string): string {
  const at = value.indexOf("@");
  if (at === -1) {
    return value;
  }
  return `${value.slice(0, at + 1)}${value.slice(at + 1).replace(/@/g, "")}`;
}

/** Muestra el @ fantasma cuando hay texto local pero aún no hay arroba. */
export function shouldShowEmailAtSuggestion(value: string): boolean {
  const cleanValue = value.trim();
  return cleanValue.length > 0 && !cleanValue.includes("@");
}

/** Inserta @ al final de la parte local (p. ej. al pulsar espacio). */
export function appendAtToEmailLocalPart(value: string): string {
  return `${value.trim()}@`;
}

export function emailDomainSuggestionsShouldOpen(value: string): boolean {
  const normalized = normalizeEmailInputValue(value);
  return normalized.includes("@") && getEmailDomainSuggestions(normalized).length > 0;
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

  return matches.slice(0, limit).map((domain) => `${localPart}@${domain}`);
}
