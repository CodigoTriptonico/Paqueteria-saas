import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ventaClient = readFileSync(join(root, "components/venta-client.tsx"), "utf8");
const customerActions = readFileSync(join(root, "app/actions/customers.ts"), "utf8");
const migration = readFileSync(
  join(root, "../supabase/migrations/093_recipient_country_link.sql"),
  "utf8",
);

describe("recipient country link eval", () => {
  it("stops recipient creation and directs the operator to configure a country", () => {
    assert.equal(ventaClient.includes("Crea un país primero"), true);
    assert.equal(ventaClient.includes("recipientCountrySetupRequired(countries)"), true);
    assert.equal(ventaClient.includes("router.push(configPricesCountryHref())"), true);
  });

  it("links new recipients to a country configured in their own organization", () => {
    assert.equal(customerActions.includes('.from("pricing_countries")'), true);
    assert.equal(customerActions.includes("country_id: country.id"), true);
    assert.equal(migration.includes("country_id uuid references public.pricing_countries"), true);
    assert.equal(migration.includes("customer_recipients_country_required"), true);
    assert.equal(migration.includes("customer_recipients_country_org_guard"), true);
  });
});
