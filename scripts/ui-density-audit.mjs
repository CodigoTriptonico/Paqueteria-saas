import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

const DEFAULT_ROOTS = ["src/app", "src/components"];
const INTERACTIVE_TAGS = new Set(["button", "a", "Link", "input", "select", "textarea", "summary"]);
const CONTAINER_TAGS = new Set(["article", "aside", "div", "dl", "fieldset", "form", "nav", "section", "ul"]);
const ESSENTIAL_PATTERNS = [
  /\b(role=["'](?:alert|dialog|status)["'])/i,
  /\b(aria-live|aria-invalid|disabled|required)\b/i,
  /\b(bg-(?:rose|amber|red)-|text-(?:rose|amber|red)-)\b/i,
  /\b(fixed|absolute)\b/i,
];

function walkFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

function tagName(node, sourceFile) {
  return node.tagName?.getText(sourceFile) ?? "";
}

function attributeText(node, sourceFile) {
  return node.attributes?.getText(sourceFile) ?? "";
}

function staticClassName(node, sourceFile) {
  const attributes = node.attributes?.properties ?? [];
  const classAttribute = attributes.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "className",
  );
  if (!classAttribute?.initializer) return "";
  if (ts.isStringLiteral(classAttribute.initializer)) return classAttribute.initializer.text;
  if (!ts.isJsxExpression(classAttribute.initializer) || !classAttribute.initializer.expression) return "";
  const expression = classAttribute.initializer.expression;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isTemplateExpression(expression)) {
    return [
      expression.head.text,
      ...expression.templateSpans.map((span) => span.literal.text),
    ].join(" ");
  }
  return "";
}

function isSurface(node, sourceFile) {
  if (!CONTAINER_TAGS.has(tagName(node, sourceFile))) return false;
  const classes = staticClassName(node, sourceFile);
  if (/\bskeleton-card\b/.test(classes)) return false;
  if (
    /\bitems-center\b/.test(classes)
    && /\bjustify-center\b/.test(classes)
    && /\bh-(?:\d+|\[)/.test(classes)
    && /\bw-(?:\d+|\[)/.test(classes)
  ) {
    return false;
  }
  return /\brounded-(?:md|lg|xl|2xl|3xl|\[)/.test(classes)
    && /\bborder(?:-\w+|-\[|\/|\s|$)/.test(classes)
    && /\bbg-(?:surface|#|\[|slate|emerald|amber|rose|sky)/.test(classes);
}

function isEssentialSurface(node, sourceFile) {
  const tag = tagName(node, sourceFile);
  if (INTERACTIVE_TAGS.has(tag) || tag === "label") return true;
  const source = `${attributeText(node, sourceFile)} ${staticClassName(node, sourceFile)}`;
  return ESSENTIAL_PATTERNS.some((pattern) => pattern.test(source));
}

function nodeLine(node, sourceFile) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function directVisibleText(node) {
  if (!node.children) return "";
  return node.children
    .filter(ts.isJsxText)
    .map((child) => child.getText().replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

export function auditSource(source, fileName = "inline.tsx") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const nestedSurfaces = [];
  const secondaryCopy = [];
  let surfaceCount = 0;
  let maxSurfaceDepth = 0;

  function visit(node, surfaceAncestors = []) {
    const isJsxNode = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
    let nextAncestors = surfaceAncestors;

    if (isJsxNode) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const surface = isSurface(opening, sourceFile);
      if (surface) {
        surfaceCount += 1;
        maxSurfaceDepth = Math.max(maxSurfaceDepth, surfaceAncestors.length + 1);
        if (surfaceAncestors.length > 0 && !isEssentialSurface(opening, sourceFile)) {
          nestedSurfaces.push({
            line: nodeLine(opening, sourceFile),
            tag: tagName(opening, sourceFile),
            depth: surfaceAncestors.length + 1,
            classes: staticClassName(opening, sourceFile),
          });
        }
        nextAncestors = [...surfaceAncestors, opening];
      }

      if (ts.isJsxElement(node)) {
        const openingText = `${attributeText(opening, sourceFile)} ${staticClassName(opening, sourceFile)}`;
        const text = directVisibleText(node);
        const muted = /\btext-slate-(?:400|500|600)\b/.test(openingText);
        const essential = ESSENTIAL_PATTERNS.some((pattern) => pattern.test(openingText));
        if (muted && !essential && text.length >= 55 && /[.!?]$/.test(text)) {
          secondaryCopy.push({
            line: nodeLine(opening, sourceFile),
            tag: tagName(opening, sourceFile),
            text,
          });
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, nextAncestors));
  }

  visit(sourceFile);
  return { surfaceCount, maxSurfaceDepth, nestedSurfaces, secondaryCopy };
}

export function auditWorkspace(workspace = process.cwd(), roots = DEFAULT_ROOTS) {
  const files = roots
    .flatMap((root) => walkFiles(resolve(workspace, root)))
    .filter((file) => !/\.(?:test|eval\.test)\.tsx?$/.test(file))
    .sort();

  const results = files.map((file) => ({
    file: relative(workspace, file).replaceAll("\\", "/"),
    ...auditSource(readFileSync(file, "utf8"), file),
  }));

  return {
    filesReviewed: results.length,
    pagesReviewed: results.filter((result) => /\/page\.tsx$/.test(result.file)).length,
    surfaceCount: results.reduce((total, result) => total + result.surfaceCount, 0),
    nestedSurfaceCandidates: results.reduce((total, result) => total + result.nestedSurfaces.length, 0),
    secondaryCopyCandidates: results.reduce((total, result) => total + result.secondaryCopy.length, 0),
    results: results.filter(
      (result) => result.nestedSurfaces.length > 0 || result.secondaryCopy.length > 0,
    ),
  };
}

function printText(report) {
  console.log(`TSX revisados: ${report.filesReviewed}`);
  console.log(`Páginas revisadas: ${report.pagesReviewed}`);
  console.log(`Superficies: ${report.surfaceCount}`);
  console.log(`Cajas anidadas candidatas: ${report.nestedSurfaceCandidates}`);
  console.log(`Textos secundarios candidatos: ${report.secondaryCopyCandidates}`);
  for (const result of report.results) {
    console.log(`\n${result.file}`);
    for (const candidate of result.nestedSurfaces) {
      console.log(`  caja L${candidate.line} profundidad=${candidate.depth} <${candidate.tag}>`);
    }
    for (const candidate of result.secondaryCopy) {
      console.log(`  ayuda L${candidate.line} <${candidate.tag}> ${candidate.text}`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const report = auditWorkspace();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printText(report);
  }
}
