export type CountryOption = {
  code: string;
  name: string;
};

const COUNTRY_NAMES_ES: Record<string, string> = {
  AF: "Afganistán",
  AL: "Albania",
  DE: "Alemania",
  AD: "Andorra",
  AO: "Angola",
  AI: "Anguila",
  AQ: "Antártida",
  AG: "Antigua y Barbuda",
  SA: "Arabia Saudí",
  DZ: "Argelia",
  AR: "Argentina",
  AM: "Armenia",
  AW: "Aruba",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaiyán",
  BS: "Bahamas",
  BH: "Baréin",
  BD: "Bangladés",
  BB: "Barbados",
  BE: "Bélgica",
  BZ: "Belice",
  BJ: "Benín",
  BM: "Bermudas",
  BY: "Bielorrusia",
  BO: "Bolivia",
  BA: "Bosnia y Herzegovina",
  BW: "Botsuana",
  BR: "Brasil",
  BN: "Brunéi",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  BT: "Bután",
  CV: "Cabo Verde",
  KH: "Camboya",
  CM: "Camerún",
  CA: "Canadá",
  BQ: "Caribe neerlandés",
  QA: "Catar",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CY: "Chipre",
  CO: "Colombia",
  KM: "Comoras",
  CG: "Congo",
  CD: "República Democrática del Congo",
  KP: "Corea del Norte",
  KR: "Corea del Sur",
  CI: "Côte d'Ivoire",
  CR: "Costa Rica",
  HR: "Croacia",
  CU: "Cuba",
  CW: "Curazao",
  DK: "Dinamarca",
  DM: "Dominica",
  EC: "Ecuador",
  EG: "Egipto",
  SV: "El Salvador",
  AE: "Emiratos Árabes Unidos",
  ER: "Eritrea",
  SK: "Eslovaquia",
  SI: "Eslovenia",
  ES: "España",
  US: "Estados Unidos",
  EE: "Estonia",
  SZ: "Esuatini",
  ET: "Etiopía",
  PH: "Filipinas",
  FI: "Finlandia",
  FJ: "Fiyi",
  FR: "Francia",
  GA: "Gabón",
  GM: "Gambia",
  GE: "Georgia",
  GH: "Ghana",
  GI: "Gibraltar",
  GD: "Granada",
  GR: "Grecia",
  GL: "Groenlandia",
  GP: "Guadalupe",
  GU: "Guam",
  GT: "Guatemala",
  GF: "Guayana Francesa",
  GG: "Guernesey",
  GN: "Guinea",
  GQ: "Guinea Ecuatorial",
  GW: "Guinea-Bisáu",
  GY: "Guyana",
  HT: "Haití",
  HN: "Honduras",
  HK: "Hong Kong",
  HU: "Hungría",
  IN: "India",
  ID: "Indonesia",
  IQ: "Irak",
  IR: "Irán",
  IE: "Irlanda",
  IM: "Isla de Man",
  IS: "Islandia",
  KY: "Islas Caimán",
  CK: "Islas Cook",
  FO: "Islas Feroe",
  FK: "Islas Malvinas",
  MP: "Islas Marianas del Norte",
  MH: "Islas Marshall",
  SB: "Islas Salomón",
  TC: "Islas Turcas y Caicos",
  VG: "Islas Vírgenes Británicas",
  VI: "Islas Vírgenes de EE. UU.",
  IL: "Israel",
  IT: "Italia",
  JM: "Jamaica",
  JP: "Japón",
  JE: "Jersey",
  JO: "Jordania",
  KZ: "Kazajistán",
  KE: "Kenia",
  KG: "Kirguistán",
  KI: "Kiribati",
  KW: "Kuwait",
  LA: "Laos",
  LS: "Lesoto",
  LV: "Letonia",
  LB: "Líbano",
  LR: "Liberia",
  LY: "Libia",
  LI: "Liechtenstein",
  LT: "Lituania",
  LU: "Luxemburgo",
  MO: "Macao",
  MG: "Madagascar",
  MY: "Malasia",
  MW: "Malaui",
  MV: "Maldivas",
  ML: "Mali",
  MT: "Malta",
  MA: "Marruecos",
  MQ: "Martinica",
  MU: "Mauricio",
  MR: "Mauritania",
  YT: "Mayotte",
  MX: "México",
  FM: "Micronesia",
  MD: "Moldavia",
  MC: "Mónaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MS: "Montserrat",
  MZ: "Mozambique",
  MM: "Myanmar (Birmania)",
  NA: "Namibia",
  NR: "Nauru",
  NP: "Nepal",
  NI: "Nicaragua",
  NE: "Níger",
  NG: "Nigeria",
  NU: "Niue",
  NO: "Noruega",
  NC: "Nueva Caledonia",
  NZ: "Nueva Zelanda",
  OM: "Omán",
  NL: "Países Bajos",
  PK: "Pakistán",
  PW: "Palaos",
  PS: "Territorios Palestinos",
  PA: "Panamá",
  PG: "Papúa Nueva Guinea",
  PY: "Paraguay",
  PE: "Perú",
  PF: "Polinesia Francesa",
  PL: "Polonia",
  PT: "Portugal",
  PR: "Puerto Rico",
  GB: "Reino Unido",
  CF: "República Centroafricana",
  CZ: "Chequia",
  DO: "República Dominicana",
  RE: "Reunión",
  RW: "Ruanda",
  RO: "Rumanía",
  RU: "Rusia",
  EH: "Sáhara Occidental",
  WS: "Samoa",
  AS: "Samoa Americana",
  BL: "San Bartolomé",
  KN: "San Cristóbal y Nieves",
  SM: "San Marino",
  MF: "San Martín",
  PM: "San Pedro y Miquelón",
  VC: "San Vicente y las Granadinas",
  SH: "Santa Elena",
  LC: "Santa Lucía",
  ST: "Santo Tomé y Príncipe",
  SN: "Senegal",
  RS: "Serbia",
  SC: "Seychelles",
  SL: "Sierra Leona",
  SG: "Singapur",
  SX: "Sint Maarten",
  SY: "Siria",
  SO: "Somalia",
  LK: "Sri Lanka",
  ZA: "Sudáfrica",
  SD: "Sudán",
  SS: "Sudán del Sur",
  SE: "Suecia",
  CH: "Suiza",
  SR: "Surinam",
  SJ: "Svalbard y Jan Mayen",
  TH: "Tailandia",
  TW: "Taiwán",
  TZ: "Tanzania",
  TJ: "Tayikistán",
  IO: "Territorio Británico del Océano Índico",
  TF: "Territorios Australes Franceses",
  TL: "Timor-Leste",
  TG: "Togo",
  TK: "Tokelau",
  TO: "Tonga",
  TT: "Trinidad y Tobago",
  TN: "Túnez",
  TM: "Turkmenistán",
  TR: "Turquía",
  TV: "Tuvalu",
  UA: "Ucrania",
  UG: "Uganda",
  UY: "Uruguay",
  UZ: "Uzbekistán",
  VU: "Vanuatu",
  VA: "Ciudad del Vaticano",
  VE: "Venezuela",
  VN: "Vietnam",
  WF: "Wallis y Futuna",
  YE: "Yemen",
  DJ: "Yibuti",
  ZM: "Zambia",
  ZW: "Zimbabue",
};

/** Alias frecuentes (inglés, abreviaturas) → ISO 3166-1 alpha-2 */
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  usa: "US",
  us: "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  mexico: "MX",
  brasil: "BR",
  brazil: "BR",
  "south korea": "KR",
  "north korea": "KP",
  "czech republic": "CZ",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
};

const excludedCountryCodes = new Set(["US"]);

const usProximityCodes = [
  "MX",
  "CA",
  "GT",
  "BZ",
  "SV",
  "HN",
  "NI",
  "CR",
  "PA",
  "PR",
  "VI",
  "GU",
  "AS",
  "MP",
  "BS",
  "CU",
  "JM",
  "HT",
  "DO",
  "TT",
  "BB",
  "KY",
  "TC",
  "VG",
  "BM",
  "AW",
  "CW",
  "SX",
  "BQ",
  "AG",
  "DM",
  "GD",
  "KN",
  "LC",
  "VC",
  "GP",
  "MQ",
  "CO",
  "VE",
  "GY",
  "SR",
  "GF",
  "BR",
  "EC",
  "PE",
  "BO",
  "PY",
  "UY",
  "AR",
  "CL",
  "ES",
  "PT",
  "GB",
  "IE",
  "FR",
  "NL",
  "BE",
  "DE",
  "IT",
  "PH",
];

function normalizeCountryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const ISO_COUNTRY_CODES = [
  "AF", "AL", "DE", "AD", "AO", "AI", "AQ", "AG", "SA", "DZ", "AR", "AM",
  "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BE", "BZ", "BJ", "BM",
  "BY", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "BT", "CV", "KH",
  "CM", "CA", "BQ", "QA", "TD", "CL", "CN", "CY", "CO", "KM", "CG", "CD",
  "KP", "KR", "CI", "CR", "HR", "CU", "CW", "DK", "DM", "EC", "EG", "SV",
  "AE", "ER", "SK", "SI", "ES", "US", "EE", "SZ", "ET", "PH", "FI", "FJ",
  "FR", "GA", "GM", "GE", "GH", "GI", "GD", "GR", "GL", "GP", "GU", "GT",
  "GF", "GG", "GN", "GQ", "GW", "GY", "HT", "HN", "HK", "HU", "IN", "ID",
  "IQ", "IR", "IE", "IM", "IS", "KY", "CK", "FO", "FK", "MP", "MH", "SB",
  "TC", "VG", "VI", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KG",
  "KI", "KW", "LA", "LS", "LV", "LB", "LR", "LY", "LI", "LT", "LU", "MO",
  "MG", "MY", "MW", "MV", "ML", "MT", "MA", "MQ", "MU", "MR", "YT", "MX",
  "FM", "MD", "MC", "MN", "ME", "MS", "MZ", "MM", "NA", "NR", "NP", "NI",
  "NE", "NG", "NU", "NO", "NC", "NZ", "OM", "NL", "PK", "PW", "PS", "PA",
  "PG", "PY", "PE", "PF", "PL", "PT", "PR", "GB", "CF", "CZ", "DO", "RE",
  "RW", "RO", "RU", "EH", "WS", "AS", "BL", "KN", "SM", "MF", "PM", "VC",
  "SH", "LC", "ST", "SN", "RS", "SC", "SL", "SG", "SX", "SY", "SO", "LK",
  "ZA", "SD", "SS", "SE", "CH", "SR", "SJ", "TH", "TW", "TZ", "TJ", "IO",
  "TF", "TL", "TG", "TK", "TO", "TT", "TN", "TM", "TR", "TV", "UA", "UG",
  "UY", "UZ", "VU", "VA", "VE", "VN", "WF", "YE", "DJ", "ZM", "ZW",
] as const;

const ISO_CODES_SET = new Set<string>(ISO_COUNTRY_CODES);

const COUNTRY_NAME_TO_CODE = (() => {
  const map = new Map<string, string>();

  for (const [code, name] of Object.entries(COUNTRY_NAMES_ES)) {
    map.set(normalizeCountryName(name), code);
  }

  for (const [alias, code] of Object.entries(COUNTRY_NAME_ALIASES)) {
    map.set(normalizeCountryName(alias), code);
  }

  return map;
})();

/** Resuelve nombre, alias o código ISO a alpha-2 (catálogo completo, incluye US). */
export function resolveCountryCodeFromString(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const upper = trimmed.toUpperCase();

  if (/^[A-Z]{2}$/.test(upper) && ISO_CODES_SET.has(upper)) {
    return upper;
  }

  return COUNTRY_NAME_TO_CODE.get(normalizeCountryName(trimmed)) || "";
}

/** Código ISO para APIs de Google Maps (geocode / places). */
export function resolveGoogleCountryCode(country?: string): string | undefined {
  const code = resolveCountryCodeFromString(country || "");

  return code || undefined;
}

export function findCountryByNormalizedName<T extends { name: string }>(
  query: string,
  list: readonly T[],
): T | undefined {
  const key = normalizeCountryName(query);
  if (!key) {
    return undefined;
  }

  return list.find((entry) => normalizeCountryName(entry.name) === key);
}

export function configPricesCountryHref(country?: string) {
  const trimmed = country?.trim();
  if (!trimmed) {
    return "/configuracion?view=prices";
  }

  return `/configuracion?view=prices&country=${encodeURIComponent(trimmed)}`;
}

const countryCodes = ISO_COUNTRY_CODES;

function buildCountryOptions(): CountryOption[] {
  const availableCountryCodes = countryCodes.filter((code) => !excludedCountryCodes.has(code));
  const countryByCode = new Map<string, CountryOption>(
    availableCountryCodes
      .map((code) => [code, { code, name: COUNTRY_NAMES_ES[code] || code }] as const)
      .filter((entry) => Boolean(entry[1].name)),
  );
  const prioritizedSet = new Set(usProximityCodes);
  const prioritizedCountries = usProximityCodes
    .filter((code) => !excludedCountryCodes.has(code))
    .map((code) => countryByCode.get(code))
    .filter((country): country is CountryOption => Boolean(country));
  const remainingCountries = availableCountryCodes
    .filter((code) => !prioritizedSet.has(code))
    .map((code) => countryByCode.get(code))
    .filter((country): country is CountryOption => Boolean(country))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  return [...prioritizedCountries, ...remainingCountries];
}

export const COUNTRY_OPTIONS: CountryOption[] = buildCountryOptions();

const countryOrderIndex = new Map(
  COUNTRY_OPTIONS.map((country, index) => [country.code, index] as const),
);

function getCountrySortIndex(country: { code: string; name?: string }) {
  const codeIndex = country.code
    ? countryOrderIndex.get(country.code.toUpperCase())
    : undefined;

  if (codeIndex !== undefined) {
    return codeIndex;
  }

  if (!country.name) {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalizedName = normalizeCountryName(country.name);
  const match = COUNTRY_OPTIONS.find(
    (entry) => normalizeCountryName(entry.name) === normalizedName,
  );

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return countryOrderIndex.get(match.code) ?? Number.MAX_SAFE_INTEGER;
}

export function compareCountriesByCatalogOrder(
  left: { code: string; name?: string },
  right: { code: string; name?: string },
): number {
  return getCountrySortIndex(left) - getCountrySortIndex(right);
}

export function resolveCountryCode(country: { code: string; name: string }) {
  const codeField = country.code?.trim().toUpperCase() || "";

  if (codeField && /^[A-Z]{2}$/.test(codeField) && ISO_CODES_SET.has(codeField)) {
    return codeField;
  }

  const fromName = country.name?.trim();

  if (fromName) {
    const resolved = resolveCountryCodeFromString(fromName);

    if (resolved) {
      return resolved;
    }
  }

  return codeField;
}

export function isCountryAlreadyConfigured(
  option: { code: string; name: string },
  configured: Array<{ code: string; name: string }>,
) {
  const optionCode = option.code.toUpperCase();
  const optionName = normalizeCountryName(option.name);

  return configured.some((country) => {
    const configuredCode = resolveCountryCode(country);

    if (configuredCode && configuredCode === optionCode) {
      return true;
    }

    return normalizeCountryName(country.name) === optionName;
  });
}
