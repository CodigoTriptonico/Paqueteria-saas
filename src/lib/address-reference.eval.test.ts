import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = readFileSync(
  join(root, "supabase/migrations/110_address_reference.sql"),
  "utf8",
);
const customerActions = readFileSync(join(root, "src/app/actions/customers.ts"), "utf8");
const senderForm = readFileSync(join(root, "src/components/sale/sale-client-form.tsx"), "utf8");
const recipientForm = readFileSync(
  join(root, "src/components/sale/sale-recipient-form.tsx"),
  "utf8",
);

describe("address reference eval", () => {
  it("persists references on customers and recipients", () => {
    assert.match(migration, /alter table public\.customers[\s\S]*address_reference/);
    assert.match(migration, /alter table public\.customer_recipients[\s\S]*address_reference/);
    assert.match(customerActions, /address_reference: input\.addressReference/);
  });

  it("exposes references in both sale address forms", () => {
    for (const form of [senderForm, recipientForm]) {
      assert.match(form, /Referencias/);
      assert.match(form, /addressReference/);
      assert.match(form, /setAddressReference/);
      assert.match(form, /boxario-.*-address-reference/);
      assert.match(form, /Indicaciones extra para encontrar el domicilio/);
    }
  });
});
