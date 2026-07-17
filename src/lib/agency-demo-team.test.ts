import assert from "node:assert/strict";
import test from "node:test";
import {
  agencyDemoAdministratorLimit,
  agencyDemoSellerLimit,
  agencyDemoTeamErrorMessage,
  agencyDemoTeamSize,
} from "@/lib/agency-demo-team";

test("agency demo team keeps one administrator and two seller seats", () => {
  assert.equal(agencyDemoAdministratorLimit, 1);
  assert.equal(agencyDemoSellerLimit, 2);
  assert.equal(agencyDemoTeamSize, 3);
});

test("agency demo team translates database limit errors", () => {
  assert.equal(
    agencyDemoTeamErrorMessage("AGENCY_SELLER_LIMIT_REACHED"),
    "Esta agencia ya tiene sus 2 vendedores permitidos durante la demo.",
  );
  assert.equal(agencyDemoTeamErrorMessage("Otro error"), "Otro error");
});
