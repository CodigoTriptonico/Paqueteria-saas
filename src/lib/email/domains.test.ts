import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendAtToEmailLocalPart,
  emailDomainSuggestionsShouldOpen,
  getEmailDomainSuggestions,
  normalizeEmailInputValue,
  shouldShowEmailAtSuggestion,
} from "./domains";

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
});

describe("normalizeEmailInputValue", () => {
  it("elimina @ duplicados despues del primero", () => {
    assert.equal(normalizeEmailInputValue("a@@b@@c.com"), "a@bc.com");
    assert.equal(normalizeEmailInputValue("felipe"), "felipe");
  });
});

describe("shouldShowEmailAtSuggestion", () => {
  it("muestra @ fantasma solo con parte local", () => {
    assert.equal(shouldShowEmailAtSuggestion("felipe"), true);
    assert.equal(shouldShowEmailAtSuggestion("  felipe  "), true);
    assert.equal(shouldShowEmailAtSuggestion(""), false);
    assert.equal(shouldShowEmailAtSuggestion("felipe@gmail.com"), false);
  });
});

describe("appendAtToEmailLocalPart", () => {
  it("recorta espacios y agrega @", () => {
    assert.equal(appendAtToEmailLocalPart("felipe "), "felipe@");
    assert.equal(appendAtToEmailLocalPart("  ana  "), "ana@");
  });
});

describe("emailDomainSuggestionsShouldOpen", () => {
  it("abre lista cuando hay sugerencias de dominio", () => {
    assert.equal(emailDomainSuggestionsShouldOpen("felipe@"), true);
    assert.equal(emailDomainSuggestionsShouldOpen("felipe"), false);
  });
});
