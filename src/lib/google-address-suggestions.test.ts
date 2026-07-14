import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterGoogleAddressSuggestions,
  leadingStreetNumber,
  likelyStreetNumberFromQuery,
  type GoogleAddressSuggestion,
} from "./google-address-suggestions";

function suggestion(mainText: string, placeId = "p1"): GoogleAddressSuggestion {
  return {
    placeId,
    description: mainText,
    mainText,
    secondaryText: "",
  };
}

describe("google-address-suggestions", () => {
  it("detects leading street numbers", () => {
    assert.equal(leadingStreetNumber("18006 Saratoga Way #511"), "18006");
    assert.equal(leadingStreetNumber("Saratoga Way"), null);
  });

  it("reads street number from composed query", () => {
    assert.equal(
      likelyStreetNumberFromQuery("18006 Saratoga Way 511 Canyon Country Santa Clarita CA 91387"),
      "18006",
    );
    assert.equal(likelyStreetNumberFromQuery("Saratoga Way Santa Clarita"), null);
  });

  it("drops generic street-only suggestions when numbered matches exist", () => {
    const filtered = filterGoogleAddressSuggestions(
      [
        suggestion("18006 Saratoga Way #511", "specific"),
        suggestion("Saratoga Way", "generic"),
      ],
      "18006 Saratoga Way 511 Santa Clarita CA 91387",
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.placeId, "specific");
  });

  it("keeps all suggestions when query has no street number", () => {
    const input = [suggestion("Saratoga Way", "a"), suggestion("Main Street", "b")];
    const filtered = filterGoogleAddressSuggestions(input, "Santa Clarita CA");

    assert.deepEqual(filtered, input);
  });

  it("keeps numbered suggestions when none match the query number exactly", () => {
    const filtered = filterGoogleAddressSuggestions(
      [suggestion("18007 Saratoga Way", "nearby"), suggestion("Saratoga Way", "generic")],
      "18006 Saratoga Way Santa Clarita",
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.placeId, "nearby");
  });

  it("does not filter when Google only returns generic suggestions", () => {
    const input = [suggestion("Saratoga Way", "only")];
    const filtered = filterGoogleAddressSuggestions(input, "18006 Saratoga Way");

    assert.deepEqual(filtered, input);
  });
});
