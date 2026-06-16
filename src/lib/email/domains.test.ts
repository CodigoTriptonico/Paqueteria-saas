import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEmailDomainSuggestions } from "./domains";

describe("getEmailDomainSuggestions", () => {
  it("no sugiere sin arroba o sin parte local", () => {
    assert.deepEqual(getEmailDomainSuggestions("felipe"), []);
    assert.deepEqual(getEmailDomainSuggestions("@gmail.com"), []);
  });

  it("lista dominios al escribir solo @", () => {
    const suggestions = getEmailDomainSuggestions("felipe@");
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((s) => s.startsWith("felipe@")));
    assert.ok(suggestions.some((s) => s === "felipe@gmail.com"));
  });

  it("filtra por prefijo del dominio", () => {
    const suggestions = getEmailDomainSuggestions("a@gm");
    assert.deepEqual(suggestions, ["a@gmail.com"]);
  });

  it("no sugiere si el correo ya está completo", () => {
    assert.deepEqual(getEmailDomainSuggestions("asd@hotmail.com"), []);
    assert.deepEqual(getEmailDomainSuggestions("  Felipe@gmail.com  "), []);
  });
});
