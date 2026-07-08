import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSalePersonListCount } from "./sale-person-list-count";

describe("formatSalePersonListCount", () => {
  it("muestra total sin filtro", () => {
    assert.equal(
      formatSalePersonListCount(22, { kind: "remitente" }),
      "22 remitentes",
    );
    assert.equal(
      formatSalePersonListCount(1, { kind: "destinatario" }),
      "1 destinatario",
    );
  });

  it("muestra X de Y con filtro y total conocido", () => {
    assert.equal(
      formatSalePersonListCount(3, {
        kind: "remitente",
        filtered: true,
        totalCount: 22,
      }),
      "3 de 22",
    );
  });

  it("muestra resultados cuando filtra sin total", () => {
    assert.equal(
      formatSalePersonListCount(3, { kind: "remitente", filtered: true }),
      "3 resultados",
    );
    assert.equal(
      formatSalePersonListCount(1, { kind: "destinatario", filtered: true }),
      "1 resultado",
    );
  });

  it("no usa de Y si el filtro no reduce la lista", () => {
    assert.equal(
      formatSalePersonListCount(22, {
        kind: "remitente",
        filtered: true,
        totalCount: 22,
      }),
      "22 resultados",
    );
  });
});
