import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRY_OPTIONS,
  resolveCountryCode,
  resolveCountryCodeFromString,
  resolveGoogleCountryCode,
} from "./country-options";

describe("resolveCountryCodeFromString", () => {
  it("resuelve todos los nombres del catálogo de destinos", () => {
    for (const country of COUNTRY_OPTIONS) {
      assert.equal(
        resolveCountryCodeFromString(country.name),
        country.code,
        `falló para ${country.name}`,
      );
    }
  });

  it("tolera acentos y mayúsculas", () => {
    assert.equal(resolveCountryCodeFromString("méxico"), "MX");
    assert.equal(resolveCountryCodeFromString("MÉXICO"), "MX");
    assert.equal(resolveCountryCodeFromString("  Colombia  "), "CO");
    assert.equal(resolveCountryCodeFromString("Perú"), "PE");
  });

  it("resuelve alias y remitentes en USA", () => {
    assert.equal(resolveCountryCodeFromString("USA"), "US");
    assert.equal(resolveCountryCodeFromString("Estados Unidos"), "US");
    assert.equal(resolveGoogleCountryCode("USA"), "US");
    assert.equal(resolveCountryCode({ code: "USA", name: "USA" }), "US");
    assert.equal(resolveCountryCode({ code: "", name: "USA" }), "US");
  });

  it("acepta códigos ISO directos", () => {
    assert.equal(resolveCountryCodeFromString("mx"), "MX");
    assert.equal(resolveCountryCodeFromString("GT"), "GT");
  });

  it("ignora códigos inválidos y usa el nombre", () => {
    assert.equal(resolveCountryCode({ code: "México", name: "México" }), "MX");
    assert.equal(resolveCountryCode({ code: "XX", name: "Guatemala" }), "GT");
  });

  it("devuelve vacío para valores desconocidos", () => {
    assert.equal(resolveCountryCodeFromString(""), "");
    assert.equal(resolveCountryCodeFromString("Atlantis"), "");
    assert.equal(resolveGoogleCountryCode(undefined), undefined);
  });
});
