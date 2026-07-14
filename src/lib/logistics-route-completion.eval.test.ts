import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const routesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/logistics-routes.ts"),
  "utf8",
);
const conductorSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/actions/conductor-tasks.ts"),
  "utf8",
);

describe("logistics route completion eval", () => {
  it("exports the route auto-complete helper", () => {
    assert.match(routesSource, /export async function tryAutoCompleteLogisticsRoute/);
    assert.match(routesSource, /logistics\.route_completed/);
  });

  it("auto-completes route after conductor task result when applicable", () => {
    assert.match(conductorSource, /tryAutoCompleteLogisticsRoute/);
    assert.match(conductorSource, /revalidatePath\("\/logistica"\)/);
  });
});
