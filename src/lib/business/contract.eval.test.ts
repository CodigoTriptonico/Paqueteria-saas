import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("Boxario business contract eval", () => {
  it("exposes USD cents, versioned operation results and explicit state machines", () => {
    const source = readFileSync(join(root, "src/lib/business/contract.ts"), "utf8");
    assert.match(source, /currency: typeof USD_CURRENCY/);
    assert.match(source, /amountCents: number/);
    assert.match(source, /operationId: string/);
    assert.match(source, /replayed: boolean/);
    assert.match(source, /version: number/);
    assert.match(source, /AGENCY_TRANSITIONS/);
    assert.match(source, /REQUEST_TRANSITIONS/);
  });
});
