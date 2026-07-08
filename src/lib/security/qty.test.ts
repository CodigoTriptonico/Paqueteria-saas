import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InvalidQuantityError,
  readPositiveIntegerQty,
  readPositiveQty,
} from "@/lib/security/qty";

describe("readPositiveQty", () => {
  it("accepts positive integers and decimals", () => {
    assert.equal(readPositiveQty(3), 3);
    assert.equal(readPositiveQty("3.5"), 3.5);
    assert.equal(readPositiveQty("10", 2), 10);
  });

  it("rejects non-positive values", () => {
    assert.throws(() => readPositiveQty(0), InvalidQuantityError);
    assert.throws(() => readPositiveQty(-1), InvalidQuantityError);
    assert.throws(() => readPositiveQty("-2"), InvalidQuantityError);
  });

  it("rejects NaN and weird strings", () => {
    assert.throws(() => readPositiveQty(NaN), InvalidQuantityError);
    assert.throws(() => readPositiveQty("abc"), InvalidQuantityError);
    assert.throws(() => readPositiveQty("3abc"), InvalidQuantityError);
    assert.throws(() => readPositiveQty(""), InvalidQuantityError);
  });

  it("readPositiveIntegerQty requires whole numbers", () => {
    assert.equal(readPositiveIntegerQty(4), 4);
    assert.throws(() => readPositiveIntegerQty(2.5), InvalidQuantityError);
  });
});
