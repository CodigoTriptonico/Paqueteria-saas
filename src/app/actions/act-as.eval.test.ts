import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "src/app/actions/act-as.ts"), "utf8");
const enterStart = source.indexOf("export async function enterClientOrganizationAction");
const exitStart = source.indexOf("export async function exitClientOrganizationAction");
const enterSource = source.slice(enterStart, exitStart);

describe("act-as action eval", () => {
  it("returns an actionable result after setting the client organization cookie", () => {
    assert.match(enterSource, /Promise<ActionResult<\{ redirectTo: string \}>>/);
    assert.match(enterSource, /cookieStore\.set\(ACT_AS_ORG_COOKIE/);
    assert.match(enterSource, /return ok\(\{ redirectTo: "\/" \}\)/);
    assert.doesNotMatch(enterSource, /redirect\(/);
  });
});
