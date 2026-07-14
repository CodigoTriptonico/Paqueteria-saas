import assert from "node:assert/strict";
import test from "node:test";
import { textIssues } from "./code-health.mjs";

test("textIssues reports debug calls and mojibake with stable locations", () => {
  assert.deepEqual(textIssues('const ok = true;\nconsole.log("debug");\nconst label = "LlegÃ³";'), [
    { type: "debug", line: 2 },
    { type: "mojibake", line: 3 },
  ]);
  assert.deepEqual(textIssues('console.error("operational error");\nconst label = "Llegó";'), []);
});
