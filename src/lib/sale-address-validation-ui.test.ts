import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addressCardSubtitle,
  resolveAddressValidationUi,
} from "./sale-address-validation-ui";

const baseInput = {
  enabled: true,
  searching: false,
  validation: { status: "idle" as const, message: "" },
  suggestionsCount: 0,
  unverifiedAccepted: false,
  hasRequiredAddress: false,
  fullAddress: "",
};

describe("resolveAddressValidationUi", () => {
  it("hides duplicate status panel while searching or showing suggestions", () => {
    const searching = resolveAddressValidationUi({
      ...baseInput,
      searching: true,
      fullAddress: "18006 Saratoga Way",
    });

    const suggestions = resolveAddressValidationUi({
      ...baseInput,
      suggestionsCount: 1,
      hasRequiredAddress: true,
      fullAddress: "18006 Saratoga Way s, Santa Clarita CA 91387, USA",
    });

    assert.equal(searching.showStatusPanel, false);
    assert.equal(suggestions.showStatusPanel, false);
    assert.equal(suggestions.showSuggestions, true);
    assert.equal(suggestions.suggestionsTitle, "1 coincidencia");
  });

  it("shows terminal status panel only when verified or explicitly unverified", () => {
    const verified = resolveAddressValidationUi({
      ...baseInput,
      validation: {
        status: "valid",
        message: "Direccion valida",
        formattedAddress: "18006 Saratoga Way, Santa Clarita CA 91387, USA",
      },
      fullAddress: "18006 Saratoga Way, Santa Clarita CA 91387, USA",
    });

    const unverified = resolveAddressValidationUi({
      ...baseInput,
      unverifiedAccepted: true,
      fullAddress: "Calle sin validar 123",
    });

    assert.equal(verified.showStatusPanel, true);
    assert.equal(verified.previewLabel, "Direccion verificada");
    assert.equal(unverified.showStatusPanel, true);
    assert.equal(unverified.tone, "unverified");
  });
});

describe("addressCardSubtitle", () => {
  it("returns short labels for the card header", () => {
    assert.equal(addressCardSubtitle("suggestions"), "Elige una sugerencia");
    assert.equal(addressCardSubtitle("valid"), "Verificada");
    assert.equal(addressCardSubtitle("idle"), "Buscar y validar en Google");
  });
});
