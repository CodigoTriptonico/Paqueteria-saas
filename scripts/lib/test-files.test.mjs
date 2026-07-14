import assert from "node:assert/strict";
import test from "node:test";
import { testFilesForLane, testLaneForFile } from "./test-files.mjs";

test("testLaneForFile separates deterministic gates from periodic evals", () => {
  assert.equal(testLaneForFile("src/lib/example.test.ts"), "gate");
  assert.equal(testLaneForFile("src/lib/example.eval.test.ts"), "eval");
  assert.equal(testLaneForFile("tests/integration/example.eval.test.mjs"), "eval");
});

test("testFilesForLane rejects unknown lanes before running files", () => {
  assert.throws(() => testFilesForLane(process.cwd(), "all"), /Lane desconocida: all/);
});
