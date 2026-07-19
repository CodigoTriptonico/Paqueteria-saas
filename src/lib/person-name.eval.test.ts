import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = readFileSync(
  join(root, "supabase/migrations/100_person_names_uppercase.sql"),
  "utf8",
);
const customerActions = readFileSync(join(root, "src/app/actions/customers.ts"), "utf8");
const senderForm = readFileSync(join(root, "src/components/sale/sale-client-form.tsx"), "utf8");
const recipientForm = readFileSync(
  join(root, "src/components/sale/sale-recipient-form.tsx"),
  "utf8",
);

describe("uppercase person name policy eval", () => {
  it("normalizes every persisted person-name column and existing rows", () => {
    for (const table of ["customers", "customer_recipients", "profiles", "time_clock_employees"]) {
      assert.match(migration, new RegExp(`before insert or update on public\\.${table}`));
      assert.match(migration, new RegExp(`update public\\.${table}`));
    }
  });

  it("normalizes new shipment and financial snapshots without rewriting history", () => {
    assert.match(migration, /before insert or update on public\.shipments/);
    assert.match(migration, /new\.recipient_snapshot/);
    assert.match(migration, /before insert or update on public\.sales/);
    assert.match(migration, /new\.customer_name_snapshot/);
    assert.doesNotMatch(migration, /update public\.(shipments|sales)/);
  });

  it("normalizes sender and recipient names at the server boundary", () => {
    assert.match(customerActions, /normalizePersonName/);
    assert.doesNotMatch(customerActions, /first_name:\s*input\.firstName\.trim\(\)/);
    assert.doesNotMatch(customerActions, /last_name:\s*input\.lastName\.trim\(\)/);
  });

  it("shows uppercase immediately in both sale forms", () => {
    for (const form of [senderForm, recipientForm]) {
      assert.match(form, /uppercasePersonNameInput/);
      assert.match(form, /setFirstName\(uppercasePersonNameInput\(event\.target\.value\)\)/);
      assert.match(form, /setLastName\(uppercasePersonNameInput\(event\.target\.value\)\)/);
    }
  });
});
