import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const routesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/logistics-routes.ts"),
  "utf8",
);
const logisticaSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8",
);
const geoEditorSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../components/logistica/logistics-address-geo-editor.tsx",
  ),
  "utf8",
);

describe("logistics geo eval", () => {
  it("exports geo patch action and editor wiring", () => {
    assert.match(routesSource, /export async function patchLogisticsTaskAddressGeoAction/);
    assert.match(geoEditorSource, /patchLogisticsTaskAddressGeoAction/);
    assert.match(logisticaSource, /LogisticsAddressGeoEditor/);
    assert.match(logisticaSource, /Corregir direccion/);
  });
});
