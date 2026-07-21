import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { custodyCurrentLabel, packageCustodyEventLabel } from "./package-custody";

test("custody labels describe every automatic and manual handoff", () => {
  assert.equal(packageCustodyEventLabel.collected, "Recogida y cargada con conductor");
  assert.equal(packageCustodyEventLabel.palletized, "Asignada a paleta");
  assert.equal(packageCustodyEventLabel.manual_handoff, "Traspaso recibido");
});

test("custody never renders an empty current holder", () => {
  assert.equal(custodyCurrentLabel("  "), "Custodia sin identificar");
  assert.equal(custodyCurrentLabel("Bodega"), "Bodega");
});

test("custody insert path assigns from-holder scalars before SQL substitution", () => {
  const fix = readFileSync(
    join(process.cwd(), "supabase/migrations/114_fix_package_custody_insert_previous_holder.sql"),
    "utf8",
  );
  const fnStart = fix.indexOf("create or replace function public.record_package_custody_status_event()");
  assert.ok(fnStart >= 0);
  const fnBody = fix.slice(fnStart);
  assert.match(fnBody, /from_holder_type_value := null/);
  assert.match(fnBody, /from_holder_type_value, from_holder_id_value, from_holder_label_value/);
  assert.equal(/else previous_holder\./.test(fnBody), false);
});
