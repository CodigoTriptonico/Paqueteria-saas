import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isProjectDevProcess } from "./dev-server.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

test("isProjectDevProcess matches next dev in this repo", () => {
  const cmd = `node ${root}\\node_modules\\next\\dist\\server\\lib\\start-server.js`;
  assert.equal(isProjectDevProcess(root, cmd), true);
});

test("isProjectDevProcess ignores cursor agent worker", () => {
  const cmd =
    "c:\\\\Users\\\\pablo\\\\AppData\\\\Roaming\\\\Cursor\\\\User\\\\globalStorage\\\\cursor-agent\\\\node.exe index.js worker start";
  assert.equal(isProjectDevProcess(root, cmd), false);
});

test("isProjectDevProcess ignores unrelated node apps", () => {
  const cmd = '"C:\\\\Program Files\\\\nodejs\\\\node.exe" C:\\\\other\\\\app\\\\server.js';
  assert.equal(isProjectDevProcess(root, cmd), false);
});
