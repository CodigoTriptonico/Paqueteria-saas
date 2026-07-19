const PERSON_NAME_LOCALE = "es";

/** Keeps the typing position stable while capitalizing each part of a human name. */
export function formatPersonNameInput(value: string) {
  return value
    .toLocaleLowerCase(PERSON_NAME_LOCALE)
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, prefix: string, letter: string) => (
      `${prefix}${letter.toLocaleUpperCase(PERSON_NAME_LOCALE)}`
    ));
}

/** Canonical format stored for a first name, surname, or complete human name. */
export function normalizePersonName(value: string) {
  return formatPersonNameInput(value.trim().replace(/\s+/g, " "));
}

export function normalizePersonNameSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
) {
  if (!snapshot) {
    return null;
  }

  const normalized = { ...snapshot };
  for (const key of ["firstName", "lastName", "name"] as const) {
    if (typeof normalized[key] === "string") {
      normalized[key] = normalizePersonName(normalized[key]);
    }
  }
  return normalized;
}
