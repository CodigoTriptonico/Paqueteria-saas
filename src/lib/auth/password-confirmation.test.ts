import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passwordConfirmationMessage } from "./password-confirmation";

describe("passwordConfirmationMessage", () => {
  it("requiere confirmar la contrase\u00f1a", () => {
    assert.equal(passwordConfirmationMessage("segura123", ""), "Confirma la contrase\u00f1a.");
  });

  it("rechaza una confirmaci\u00f3n distinta", () => {
    assert.equal(
      passwordConfirmationMessage("segura123", "segura124"),
      "Las contrase\u00f1as no coinciden.",
    );
  });

  it("acepta la misma contrase\u00f1a con espacios externos", () => {
    assert.equal(passwordConfirmationMessage(" segura123 ", "segura123"), null);
  });
});
