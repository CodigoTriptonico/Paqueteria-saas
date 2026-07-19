import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePersonName,
  normalizePersonNameSnapshot,
  formatPersonNameInput,
} from "./person-name";

describe("person name formatting", () => {
  it("stores names and surnames with capital initials", () => {
    assert.equal(normalizePersonName("  Carlos   Santa  "), "Carlos Santa");
  });

  it("preserves accents, apostrophes and hyphens", () => {
    assert.equal(normalizePersonName("JOSÉ O'NEILL-PÉREZ"), "José O'Neill-Pérez");
  });

  it("formats while typing without trimming the caret-adjacent spaces", () => {
    assert.equal(formatPersonNameInput("  mARÍA "), "  María ");
  });

  it("keeps empty values empty", () => {
    assert.equal(normalizePersonName("   "), "");
  });

  it("normalizes snapshot names without changing contact or address data", () => {
    assert.deepEqual(
      normalizePersonNameSnapshot({
        name: "ANA MARÍA DE LEÓN",
        phone: "+1 555 0100",
        address: "Calle Principal",
      }),
      {
        name: "Ana María De León",
        phone: "+1 555 0100",
        address: "Calle Principal",
      },
    );
    assert.deepEqual(normalizePersonNameSnapshot({}), {});
  });
});
