import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAssignableRouteMemberRole } from "./route-members";

describe("route members", () => {
  it("only allows conductor profiles as chofer options", () => {
    assert.equal(isAssignableRouteMemberRole("conductor"), true);
    assert.equal(isAssignableRouteMemberRole("administrador"), false);
    assert.equal(isAssignableRouteMemberRole("vendedor"), false);
  });
});
