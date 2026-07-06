import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const recipientListSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-recipient-list.tsx"),
  "utf8",
);
const senderListSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-sender-list.tsx"),
  "utf8",
);
const personCardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/sale/sale-person-card.tsx"),
  "utf8",
);

describe("sale recipient empty state eval", () => {
  it("explains when the selected sender has no recipients and offers create", () => {
    assert.equal(recipientListSource.includes("searchActive"), true);
    assert.equal(
      recipientListSource.includes("Este remitente no tiene destinatarios registrados"),
      true,
    );
    assert.equal(recipientListSource.includes("Sin resultados para esa búsqueda"), true);
    assert.equal(recipientListSource.includes('label="Nuevo destinatario"'), true);
    assert.equal(recipientListSource.includes("Sin destinatarios"), false);
  });

  it("marks senders without recipients before selection", () => {
    assert.equal(senderListSource.includes('"Sin dest."'), true);
  });

  it("keeps empty-state text readable on dark surfaces", () => {
    assert.equal(personCardSource.includes("text-amber-200/45"), false);
    assert.equal(personCardSource.includes("text-amber-100/85"), true);
  });
});
