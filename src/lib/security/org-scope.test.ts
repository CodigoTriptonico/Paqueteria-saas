import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OrgScopeError,
  assertSameOrgCustomerIds,
  assertSameOrgRecipientIds,
  assertSameOrgWarehouseIds,
} from "@/lib/security/org-scope";

type QueryResult = { data: { id: string }[] | null; error: null };

function mockSupabase(rows: { id: string }[]) {
  let queriedTable = "";

  const query = {
    orgId: "",
    ids: [] as string[],
    select() {
      return query;
    },
    eq(column: string, value: string) {
      if (column === "organization_id") {
        query.orgId = value;
      }
      return query;
    },
    in(_column: string, ids: string[]) {
      query.ids = ids.filter(Boolean);
      return query;
    },
    then(resolve: (value: QueryResult) => void) {
      const filtered = rows.filter((row) => query.ids.includes(row.id));
      resolve({ data: filtered, error: null });
    },
  };

  return {
    from(table: string) {
      queriedTable = table;
      return query;
    },
    getQueriedTable() {
      return queriedTable;
    },
  };
}

describe("assertSameOrgWarehouseIds", () => {
  it("passes when all warehouses belong to org", async () => {
    const supabase = mockSupabase([{ id: "wh-1" }, { id: "wh-2" }]);
    await assertSameOrgWarehouseIds(supabase as never, "org-1", ["wh-1", "wh-2"]);
    assert.equal(supabase.getQueriedTable(), "warehouses");
  });

  it("throws when a warehouse is outside org", async () => {
    const supabase = mockSupabase([{ id: "wh-1" }]);
    await assert.rejects(
      () => assertSameOrgWarehouseIds(supabase as never, "org-1", ["wh-1", "wh-other"]),
      OrgScopeError,
    );
  });

  it("ignores empty ids", async () => {
    const supabase = mockSupabase([]);
    await assertSameOrgCustomerIds(supabase as never, "org-1", ["", null as unknown as string]);
    assert.equal(supabase.getQueriedTable(), "");
  });
});

describe("assertSameOrgRecipientIds", () => {
  it("queries customer_recipients table", async () => {
    const supabase = mockSupabase([{ id: "rcp-1" }]);
    await assertSameOrgRecipientIds(supabase as never, "org-1", ["rcp-1"]);
    assert.equal(supabase.getQueriedTable(), "customer_recipients");
  });

  it("throws when a recipient is outside org", async () => {
    const supabase = mockSupabase([{ id: "rcp-1" }]);
    await assert.rejects(
      () => assertSameOrgRecipientIds(supabase as never, "org-1", ["rcp-1", "rcp-other"]),
      OrgScopeError,
    );
    assert.equal(supabase.getQueriedTable(), "customer_recipients");
  });
});
