import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  organizationBrandInitials,
  resolveOrganizationBrandTitle,
  resolveOrganizationBranding,
} from "@/lib/organizations/branding";

describe("organization branding", () => {
  it("prefers acronym for the sidebar brand title", () => {
    assert.equal(resolveOrganizationBrandTitle("Acme Logística", "ACME"), "ACME");
  });

  it("falls back to the full company name when acronym is empty", () => {
    assert.equal(resolveOrganizationBrandTitle("Acme Logística", ""), "Acme Logística");
  });

  it("builds invoice branding with full name and short badge", () => {
    const branding = resolveOrganizationBranding({
      name: "Acme Logística",
      shortName: "ACME",
    });

    assert.equal(branding.name, "Acme Logística");
    assert.equal(branding.brandTitle, "ACME");
    assert.equal(organizationBrandInitials(branding.shortName || branding.brandTitle), "AC");
  });
});
