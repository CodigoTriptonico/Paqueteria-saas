import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "109_replace_pricing_config_recipient_safe.sql",
);
const migrationSource = readFileSync(migrationPath, "utf8");
const pricingActionSource = readFileSync(
  join(root, "src", "app", "actions", "pricing.ts"),
  "utf8",
);
const resetCatalogSource = readFileSync(
  join(root, "scripts", "reset-scgs-catalog.mjs"),
  "utf8",
);

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function public.${functionName}(`);
  assert.notEqual(start, -1, `missing function ${functionName}`);
  const bodyStart = source.indexOf("begin", start);
  const end = source.indexOf("\nend;\n$$", bodyStart);
  assert.notEqual(bodyStart, -1, `missing body for ${functionName}`);
  assert.notEqual(end, -1, `missing end for ${functionName}`);
  return source.slice(bodyStart, end);
}

describe("109 replace_pricing_config recipient-safe migration", () => {
  it("upserts countries instead of deleting rows referenced by recipients", () => {
    const body = extractFunctionBody(migrationSource, "replace_pricing_config");
    assert.doesNotMatch(body, /delete from public\.pricing_countries where organization_id = target_org_id;/i);
    assert.match(body, /PRICING_COUNTRY_IN_USE/);
    assert.match(body, /update public\.customer_recipients recipient/);
    assert.match(body, /delete from public\.pricing_countries country/);
    assert.match(migrationSource, /#variable_conflict use_variable/);
  });
});

describe("pricing save action recipient guard", () => {
  it("maps PRICING_COUNTRY_IN_USE to an operator-facing message", () => {
    assert.match(pricingActionSource, /PRICING_COUNTRY_IN_USE/);
    assert.match(pricingActionSource, /destinatarios vinculados/);
  });
});

describe("reset-scgs-catalog recipient guard", () => {
  it("keeps pricing_countries linked to recipients", () => {
    assert.match(resetCatalogSource, /customer_recipients recipient/);
    assert.match(resetCatalogSource, /recipient\.country_id = country\.id/);
  });
});
