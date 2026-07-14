import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("venta parses context-menu datasets through one helper", async () => {
  const source = await readFile(
    new URL("../components/venta-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /saleContextTargetData\(target\.dataset\)/);
  assert.doesNotMatch(source, /target\.dataset\.saleContextPhones\.split/);
  assert.doesNotMatch(source, /target\.dataset\.saleContextStreet/);
});
