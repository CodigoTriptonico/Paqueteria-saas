export type GoogleAddressSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  postalCode?: string;
};

/** Número al inicio del main_text de Google, p. ej. "18006 Saratoga Way". */
export function leadingStreetNumber(text: string): string | null {
  const match = text.trim().match(/^(\d{1,6})\b/);
  return match?.[1] ?? null;
}

/** Primer número de calle en la consulta (calle suele ir primero en el query compuesto). */
export function likelyStreetNumberFromQuery(query: string): string | null {
  const trimmed = query.trim();
  const atStart = trimmed.match(/^(\d{1,6})\s+\S/);
  if (atStart) {
    return atStart[1];
  }

  const earlyInText = trimmed.match(/\b(\d{1,6})\s+[A-Za-zÀ-ÿ]/);
  return earlyInText?.[1] ?? null;
}

/**
 * Si el usuario escribió número de calle, oculta sugerencias genéricas (solo nombre de vía)
 * cuando Google también devuelve coincidencias con número.
 */
export function filterGoogleAddressSuggestions(
  suggestions: GoogleAddressSuggestion[],
  query: string,
): GoogleAddressSuggestion[] {
  if (suggestions.length <= 1) {
    return suggestions;
  }

  const queryNumber = likelyStreetNumberFromQuery(query);
  if (!queryNumber) {
    return suggestions;
  }

  const withLeadingNumber = suggestions.filter((suggestion) =>
    Boolean(leadingStreetNumber(suggestion.mainText)),
  );

  if (withLeadingNumber.length === 0) {
    return suggestions;
  }

  const matchingQueryNumber = withLeadingNumber.filter(
    (suggestion) => leadingStreetNumber(suggestion.mainText) === queryNumber,
  );

  if (matchingQueryNumber.length > 0) {
    return matchingQueryNumber;
  }

  return withLeadingNumber;
}
