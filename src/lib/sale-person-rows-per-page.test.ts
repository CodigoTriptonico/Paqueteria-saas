import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveSalePersonPageSize,
  salePersonRowsThatFit,
} from "./sale-person-rows-per-page";

describe("salePersonRowsThatFit", () => {
  it("fills the frame with as many rows as fit without scroll", () => {
    assert.equal(salePersonRowsThatFit(400, 50), 8);
    assert.equal(salePersonRowsThatFit(520, 50), 10);
    assert.equal(salePersonRowsThatFit(49, 50), 1);
  });
});

describe("resolveSalePersonPageSize", () => {
  it("shows every item on one page when they all fit", () => {
    assert.equal(resolveSalePersonPageSize(16, 14), 14);
    assert.equal(resolveSalePersonPageSize(10, 14), 10);
    assert.equal(resolveSalePersonPageSize(16, 0), 16);
  });
});
