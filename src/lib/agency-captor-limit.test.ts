import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captorAgencyLimitMessage,
  demoAgenciesPerCaptor,
  isCaptorAgencyLimitError,
} from "@/lib/agency-captor-limit";

describe("captor agency demo limit", () => {
  it("uses three agencies as the default demo allowance", () => {
    assert.equal(demoAgenciesPerCaptor, 3);
    assert.equal(
      captorAgencyLimitMessage(),
      "Este captador ya tiene las 3 agencias permitidas durante la demo.",
    );
  });

  it("recognizes the database limit error without hiding other errors", () => {
    assert.equal(isCaptorAgencyLimitError("CAPTOR_AGENCY_LIMIT_REACHED"), true);
    assert.equal(isCaptorAgencyLimitError("FORBIDDEN"), false);
  });
});
