import assert from "node:assert/strict";
import test from "node:test";
import {
  COUNTRIES,
  isSameCountry,
  normalizeCountryName,
  pickRandomRecipientCountries,
  recipientForSenderRandom,
  shuffle,
} from "./scgs-demo-recipients.mjs";

test("normalizeCountryName ignora acentos", () => {
  assert.equal(normalizeCountryName("México"), normalizeCountryName("Mexico"));
});

test("isSameCountry compara países con y sin acento", () => {
  assert.equal(isSameCountry("México", "Mexico"), true);
  assert.equal(isSameCountry("Colombia", "Guatemala"), false);
});

test("shuffle conserva elementos", () => {
  const input = [1, 2, 3, 4, 5];
  const output = shuffle(input, () => 0.1);
  assert.deepEqual([...output].sort(), input);
});

test("pickRandomRecipientCountries devuelve entre 2 y 6 países únicos", () => {
  let sequence = 0;
  const random = () => {
    sequence += 1;
    return (sequence % 97) / 97;
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const picked = pickRandomRecipientCountries(random);
    assert.ok(picked.length >= 2);
    assert.ok(picked.length <= COUNTRIES.length);
    assert.equal(new Set(picked.map((country) => country.code)).size, picked.length);
  }
});

test("recipientForSenderRandom usa apellido del remitente", () => {
  const sender = { first_name: "Demo", last_name: "Castillo" };
  const recipient = recipientForSenderRandom(sender, "México", () => 0);
  assert.ok(recipient);
  assert.equal(recipient.last_name, "Castillo");
  assert.ok(recipient.first_name);
  assert.ok(recipient.phone);
});
