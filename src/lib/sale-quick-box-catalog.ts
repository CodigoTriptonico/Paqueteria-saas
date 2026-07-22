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

export function listQuickSaleCountries(countryBoxes: Record<string, string[][]>): string[] {
  return Object.entries(countryBoxes)
    .filter(([, boxes]) => boxes.length > 0)
    .map(([country]) => country)
    .sort((left, right) => left.localeCompare(right, "es"));
}

export function resolveQuickSaleBoxCatalog(
  countryBoxes: Record<string, string[][]>,
  preferredCountry = "USA",
): QuickSaleBoxCatalog | null {
  const countries = listQuickSaleCountries(countryBoxes);

  if (!countries.length) {
    return null;
  }

  const preferredKey = normalizeCountry(preferredCountry);
  const preferred = countries.find((country) => normalizeCountry(country) === preferredKey);
  const country = preferred || countries[0];
  const boxes = countryBoxes[country] || [];

  if (!boxes.length) {
    return null;
  }

  return { country, boxes };
}
