import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CUSTOMER_LIST_LIMIT,
  MAX_CUSTOMER_LIST_LIMIT,
  normalizeCustomerListParams,
} from "@/lib/customers/list-params";

describe("normalizeCustomerListParams", () => {
  it("applies defaults", () => {
    assert.deepEqual(normalizeCustomerListParams(), {
      limit: DEFAULT_CUSTOMER_LIST_LIMIT,
      offset: 0,
      query: "",
    });
  });

  it("clamps limit and offset", () => {
    assert.deepEqual(normalizeCustomerListParams({ limit: 999, offset: -3, query: "  ana " }), {
      limit: MAX_CUSTOMER_LIST_LIMIT,
      offset: 0,
      query: "ana",
    });
  });
});
