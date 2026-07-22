export type QuickSaleBoxCatalog = {
  country: string;
  boxes: string[][];
};

function normalizeCountry(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function resolveQuickSaleBoxCatalog(
  countryBoxes: Record<string, string[][]>,
  preferredCountry = "USA",
): QuickSaleBoxCatalog | null {
  const entries = Object.entries(countryBoxes).filter(([, boxes]) => boxes.length > 0);

  if (!entries.length) {
    return null;
  }

  const preferredKey = normalizeCountry(preferredCountry);
  const preferred = entries.find(([country]) => normalizeCountry(country) === preferredKey);
  const [country, boxes] = preferred || entries[0];

  return { country, boxes };
}
