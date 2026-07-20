import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("leaf ensure and movement actions share the same persistence helper", async () => {
  const source = await readFile(
    new URL("../app/actions/inventory.ts", import.meta.url),
    "utf8",
  );
  const ensureStart = source.indexOf("export async function ensureInventoryLeafItemAction");
  const movementStart = source.indexOf(
    "export async function recordInventoryMovementForLeafAction",
  );
  const photoStart = source.indexOf("export async function uploadInventoryItemPhotoAction");
  const ensureAction = source.slice(ensureStart, movementStart);
  const movementAction = source.slice(movementStart, photoStart);

  assert.match(ensureAction, /ensureInventoryLeafState\(/);
  assert.match(movementAction, /ensureInventoryLeafState\(/);
  assert.doesNotMatch(ensureAction, /\.from\("inventory_(?:categories|items|stock)"\)/);
  assert.doesNotMatch(movementAction, /\.from\("inventory_(?:categories|items|stock)"\)/);
});
