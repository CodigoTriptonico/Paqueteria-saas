import fs from "node:fs";

const res = await fetch("https://restcountries.com/v3.1/all?fields=cca2,idd");
const data = await res.json();
const map = {};

for (const country of data) {
  const root = country.idd?.root?.replace("+", "") ?? "";
  const suffixes = country.idd?.suffixes ?? [];

  if (!root) {
    continue;
  }

  const dial = (suffixes.length === 1 ? root + suffixes[0] : root).replace(/\D/g, "");
  map[country.cca2] = dial;
}

const lines = Object.entries(map)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([iso, dial]) => `  ${iso}: "${dial}",`);

const output = `/** ISO 3166-1 alpha-2 → código de marcación (sin +). Generado con scripts/generate-dial-codes.mjs */\nexport const DIAL_CODE_BY_ISO: Record<string, string> = {\n${lines.join("\n")}\n};\n`;

fs.writeFileSync("src/lib/phone/dial-codes-by-iso.ts", output);
console.log(`Wrote ${Object.keys(map).length} dial codes.`);
