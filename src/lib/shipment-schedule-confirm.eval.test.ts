import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);

describe("shipment schedule confirm eval", () => {
  it("opens one explicit route panel before creating the driver task", () => {
    assert.match(enviosSource, /setRouteProgramTarget\(\{ row, kind \}\)/);
    assert.match(enviosSource, /<LogisticsTaskScheduleConfirmPanel/);
    assert.match(enviosSource, /confirmLabel="Asignar ruta"/);
    assert.match(enviosSource, /onConfirm=\{\(input\) => void confirmProgramRoute\(input\)\}/);
  });

  it("keeps a separate explicit pending-route decision", () => {
    assert.match(enviosSource, /allowPendingRoute/);
    assert.match(enviosSource, /onConfirmPendingRoute=\{\(\) => void confirmPendingRoute\(\)\}/);
    assert.match(enviosSource, /source: "envios\.program_route_pending"/);
  });
});
