import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMapsNavigationUrl } from "@/lib/logistics-navigation";

describe("logistics-navigation", () => {
  it("builds google and apple navigation urls", () => {
    const urls = buildMapsNavigationUrl({
      lat: 34.05,
      lng: -118.25,
      label: "Cliente",
    });

    assert.ok(urls);
    assert.match(urls.google, /google\.com\/maps/);
    assert.match(urls.apple, /maps:\/\//);
  });

  it("returns null without coordinates", () => {
    assert.equal(buildMapsNavigationUrl({ lat: null, lng: 1 }), null);
  });
});
