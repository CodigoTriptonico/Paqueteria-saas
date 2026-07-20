#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "Carpeta para subir a ChatGPT");

const rootFiles = [
  "README.md",
  "AGENTS.md",
  "DESARROLLO-LOCAL.md",
  "BASE-LOCAL.md",
  "SETUP.md",
  "UI-STYLE.md",
  "RESPALDOS.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.mjs",
  "knip.json",
  "postcss.config.mjs",
  "next.config.ts",
  ".env.example",
  ".env.local.template",
  ".env.remote.example",
];

const dirs = ["docs", "src", "scripts", "supabase", "tests", "public"];

function countFiles(dir) {
  let count = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else {
        count += 1;
        bytes += statSync(full).size;
      }
    }
  }
  return { count, bytes };
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const file of rootFiles) {
  const src = join(root, file);
  if (existsSync(src)) cpSync(src, join(dest, file));
}

for (const dir of dirs) {
  const src = join(root, dir);
  if (existsSync(src)) cpSync(src, join(dest, dir), { recursive: true });
}

const leeme = `# Carpeta para subir a ChatGPT

Copia del proyecto **sin secretos ni carpetas generadas**, lista para subir a un Proyecto de ChatGPT o comprimir en ZIP.

## Qué incluye

- Documentación: \`README.md\`, \`AGENTS.md\`, \`DESARROLLO-LOCAL.md\`, \`BASE-LOCAL.md\`, \`SETUP.md\`, \`UI-STYLE.md\`, \`docs/\`
- Código: \`src/\`, \`scripts/\`, \`supabase/\`, \`tests/\`, \`public/\`
- Config: \`package.json\`, \`tsconfig.json\`, \`next.config.ts\`, etc.
- Plantillas de entorno: \`.env.example\`, \`.env.local.template\`, \`.env.remote.example\`

## Qué NO incluye (a propósito)

- \`.env.local\` y cualquier archivo con credenciales
- \`node_modules/\`
- \`.next/\` y otros artefactos de build
- \`.git/\`

## Cómo subirlo a ChatGPT

1. Comprime esta carpeta en un **ZIP** (clic derecho → Comprimir).
2. En ChatGPT, crea un **Proyecto** (ej. "Boxario").
3. Sube el ZIP o arrastra la carpeta entera a **Archivos del proyecto**.
4. Si ChatGPT no acepta el ZIP completo, sube primero los \`.md\` de la raíz y \`docs/\`, y luego \`src/\` por partes según el tema.

## Regenerar esta carpeta

Desde la raíz del repo:

\`\`\`powershell
npm run export:chatgpt
\`\`\`

Generado: ${new Date().toISOString().slice(0, 10)}
`;

writeFileSync(join(dest, "LEEME.md"), leeme, "utf8");

const { count, bytes } = countFiles(dest);
const sizeMb = (bytes / (1024 * 1024)).toFixed(2);
console.log(`Carpeta lista: ${dest}`);
console.log(`Archivos: ${count}`);
console.log(`Tamaño: ${sizeMb} MB`);
