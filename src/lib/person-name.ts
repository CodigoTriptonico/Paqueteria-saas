const PERSON_NAME_LOCALE = "es";

/** Keeps the typing position stable while making human names visibly consistent. */
export function uppercasePersonNameInput(value: string) {
  return value.toLocaleUpperCase(PERSON_NAME_LOCALE);
}

/** Canonical format stored for a first name, surname, or complete human name. */
export function normalizePersonName(value: string) {
  return uppercasePersonNameInput(value).trim().replace(/\s+/g, " ");
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
