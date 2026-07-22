import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertStoragePathOwnedBy,
  extractStorageObjectPath,
  isSafeStorageObjectPath,
  storagePathOwnedBy,
} from "./storage-url";

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

describe("storage path ownership", () => {
  it("accepts owner-prefixed paths and rejects traversal or foreign folders", () => {
    assert.equal(isSafeStorageObjectPath("org-1/a.webp"), true);
    assert.equal(isSafeStorageObjectPath("org-1/../org-2/a.webp"), false);
    assert.equal(isSafeStorageObjectPath("org-1/%2e%2e/org-2/a.webp"), false);
    assert.equal(storagePathOwnedBy("org-1/logo.webp", "org-1"), true);
    assert.equal(storagePathOwnedBy("org-2/logo.webp", "org-1"), false);
    assert.equal(storagePathOwnedBy("org-1", "org-1"), true);
    assert.throws(() => assertStoragePathOwnedBy("org-2/x", "org-1"), /FORBIDDEN_STORAGE_PATH/);
  });
});
