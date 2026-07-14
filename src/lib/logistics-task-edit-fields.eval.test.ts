import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("edit and reprogram panels share one logistics task field set", async () => {
  const [editPanel, reprogramPanel, sharedFields] = await Promise.all([
    readFile(
      new URL("../components/logistica/logistics-task-edit-panel.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/logistica/logistics-task-reprogram-panel.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/logistica/logistics-task-edit-fields.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(editPanel, /<LogisticsTaskEditFields/);
  assert.match(reprogramPanel, /<LogisticsTaskEditFields/);
  assert.match(sharedFields, /Programación/);
  assert.match(sharedFields, /ScheduleTimeField/);
  assert.match(sharedFields, /Buscar bodega/);
  assert.equal(editPanel.match(/ScheduleTimeField/g)?.length, undefined);
  assert.equal(reprogramPanel.match(/ScheduleTimeField/g)?.length, undefined);
});
