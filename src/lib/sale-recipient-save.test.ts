import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  recipientAddressSatisfied,
  recipientHasRequiredAddress,
  recipientSaveEnabled,
} from "./sale-recipient-save";

describe("sale-recipient-save", () => {
  it("requires Google validation by default", () => {
    assert.equal(
      recipientAddressSatisfied("idle", false, true),
      false,
    );
    assert.equal(
      recipientAddressSatisfied("valid", false, false),
      true,
    );
  });

  it("allows bypass when skip is confirmed and address fields are complete", () => {
    assert.equal(
      recipientAddressSatisfied("invalid", true, true),
      true,
    );
    assert.equal(
      recipientAddressSatisfied("invalid", true, false),
      false,
    );
  });

  it("checks required address parts for unverified save", () => {
    assert.equal(
      recipientHasRequiredAddress({
        street: "Av. Reforma 123",
        city: "CDMX",
        state: "CDMX",
        postalCode: "06600",
      }),
      true,
    );
    assert.equal(
      recipientHasRequiredAddress({
        street: "Av. Reforma 123",
        city: "",
        state: "CDMX",
        postalCode: "06600",
      }),
      false,
    );
  });

  it("enables save for duplicate without address validation", () => {
    assert.equal(
      recipientSaveEnabled({
        firstName: "Maria",
        lastName: "Lopez",
        phone: "+5215512345678",
        country: "Mexico",
        duplicateRecipient: true,
        validationStatus: "idle",
        skipVerification: false,
        hasRequiredAddress: false,
      }),
      true,
    );
  });
});
