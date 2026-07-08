import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractStorageObjectPath } from "./storage-url";

describe("extractStorageObjectPath", () => {
  it("returns raw paths unchanged", () => {
    assert.equal(
      extractStorageObjectPath("logistics-vehicle-photos", "org-1/photo.webp"),
      "org-1/photo.webp",
    );
  });

  it("extracts path from public storage urls", () => {
    assert.equal(
      extractStorageObjectPath(
        "logistics-vehicle-photos",
        "http://127.0.0.1:54321/storage/v1/object/public/logistics-vehicle-photos/org-1/photo.webp",
      ),
      "org-1/photo.webp",
    );
  });

  it("rejects empty values", () => {
    assert.equal(extractStorageObjectPath("logistics-vehicle-photos", ""), null);
  });
});
