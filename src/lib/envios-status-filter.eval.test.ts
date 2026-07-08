import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const displaySource = readFileSync(
  join(process.cwd(), "src/lib/shipment-display.ts"),
  "utf8",
);
const enviosSource = readFileSync(
  join(process.cwd(), "src/components/envios-client.tsx"),
  "utf8",
);

describe("envios status filter buckets eval", () => {
  it("defines the four tracking bucket labels without pendiente wording", () => {
    assert.match(displaySource, /label: "Recolecciones"/);
    assert.match(displaySource, /label: "Entregas"/);
    assert.match(displaySource, /label: "En oficina"/);
    assert.match(displaySource, /label: "En tránsito"/);
    assert.doesNotMatch(displaySource, /label: "Ya en destino final"/);
    assert.doesNotMatch(displaySource, /SHIPMENT_STATUS_FILTER_OPTIONS/);
  });

  it("filters envios by bucket id instead of substring matching", () => {
    assert.match(enviosSource, /matchesEnviosStatusFilter\(row, statusFilter\)/);
    assert.doesNotMatch(enviosSource, /shipmentOperationalStatusLabel\(row\)\.toLowerCase\(\)\.includes/);
  });
});
