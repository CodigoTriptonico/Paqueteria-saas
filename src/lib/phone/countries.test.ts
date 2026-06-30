import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPhoneNumber,
  filterPhoneCountries,
  formatNationalPhoneDigits,
  getPhoneDialCodeForCountryName,
  getPhoneIsoForCountryName,
  isValidNationalPhone,
  maxNationalDigitsForDialCode,
  splitPhoneNumber,
} from "@/lib/phone/countries";

test("splits NANP numbers into country 1 and national 10 digits", () => {
  assert.deepEqual(splitPhoneNumber("+1-305-555-0100"), {
    dialCode: "1",
    nationalDigits: "3055550100",
  });
});

test("splits Colombia +57", () => {
  assert.deepEqual(splitPhoneNumber("+57-300-123-4567"), {
    dialCode: "57",
    nationalDigits: "3001234567",
  });
});

test("builds display with dial prefix and national formatting", () => {
  assert.equal(buildPhoneNumber("57", "3001234567"), "+57-300-123-4567");
  assert.equal(buildPhoneNumber("1", "3055550100"), "+1-305-555-0100");
});

test("filterPhoneCountries matches label, dial code and iso", () => {
  assert.deepEqual(
    filterPhoneCountries("salvador").map((country) => country.id),
    ["sv"],
  );
  assert.deepEqual(filterPhoneCountries("503").map((country) => country.id), ["sv"]);
  assert.deepEqual(filterPhoneCountries("mx").map((country) => country.id), ["mx"]);
});

test("maps destination country names to phone dial codes", () => {
  assert.equal(getPhoneDialCodeForCountryName("México"), "52");
  assert.equal(getPhoneDialCodeForCountryName("Colombia"), "57");
  assert.equal(getPhoneDialCodeForCountryName("USA"), "1");
  assert.equal(getPhoneIsoForCountryName("Guatemala"), "GT");
});

test("NANP (+1) caps national number at 10 digits", () => {
  assert.equal(maxNationalDigitsForDialCode("1"), 10);
  assert.equal(formatNationalPhoneDigits("1", "51515165156165"), "515-151-6515");
  assert.equal(isValidNationalPhone("+1-515-151-6515-6165"), false);
  assert.equal(isValidNationalPhone("+1-305-555-0100"), true);
  assert.equal(isValidNationalPhone("+52-55-1234-5678"), true);
});

test("dial-only value keeps selected country without leaking into national field", () => {
  assert.deepEqual(splitPhoneNumber("+503"), {
    dialCode: "503",
    nationalDigits: "",
  });
  assert.deepEqual(splitPhoneNumber("+52"), {
    dialCode: "52",
    nationalDigits: "",
  });
  assert.deepEqual(splitPhoneNumber("+502"), {
    dialCode: "502",
    nationalDigits: "",
  });
});
