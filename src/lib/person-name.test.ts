import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePersonName,
  normalizePersonNameSnapshot,
  uppercasePersonNameInput,
} from "./person-name";

describe("person name normalization", () => {
  it("stores names and surnames in uppercase", () => {
    assert.equal(normalizePersonName("  Carlos   Santa  "), "CARLOS SANTA");
  });

  it("preserves accents, apostrophes and hyphens", () => {
    assert.equal(normalizePersonName("josé o'neill-pérez"), "JOSÉ O'NEILL-PÉREZ");
  });

  it("uppercases while typing without trimming the caret-adjacent spaces", () => {
    assert.equal(uppercasePersonNameInput("  maría "), "  MARÍA ");
  });

  it("keeps empty values empty", () => {
    assert.equal(normalizePersonName("   "), "");
  });

  it("normalizes snapshot names without changing contact or address data", () => {
    assert.deepEqual(
      normalizePersonNameSnapshot({
        name: "Ana María de León",
        phone: "+1 555 0100",
        address: "Calle Principal",
      }),
      {
        name: "ANA MARÍA DE LEÓN",
        phone: "+1 555 0100",
        address: "Calle Principal",
      },
    );
    assert.deepEqual(normalizePersonNameSnapshot({}), {});
  });
});
