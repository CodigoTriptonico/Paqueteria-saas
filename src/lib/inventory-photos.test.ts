import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVENTORY_ITEM_PHOTO_BUCKET,
  normalizeInventoryItemPhotoPath,
  validateInventoryItemPhoto,
} from "./inventory-photos";

describe("inventory-photos", () => {
  it("validates supported image types and size", () => {
    assert.equal(
      validateInventoryItemPhoto({ size: 1024, type: "image/jpeg" }).ok,
      true,
    );
    assert.equal(
      validateInventoryItemPhoto({ size: 5 * 1024 * 1024, type: "image/jpeg" }).ok,
      false,
    );
    assert.equal(
      validateInventoryItemPhoto({ size: 1024, type: "image/gif" }).ok,
      false,
    );
  });

  it("normalizes owned paths and rejects foreign organization folders", () => {
    const path = "org-1/photo.webp";
    assert.equal(normalizeInventoryItemPhotoPath(path, "org-1"), path);
    assert.equal(
      normalizeInventoryItemPhotoPath(
        `https://example.supabase.co/storage/v1/object/public/${INVENTORY_ITEM_PHOTO_BUCKET}/${path}`,
        "org-1",
      ),
      path,
    );
    assert.equal(normalizeInventoryItemPhotoPath("org-2/photo.webp", "org-1"), "");
    assert.equal(normalizeInventoryItemPhotoPath("org-1/../org-2/x.webp", "org-1"), "");
  });
});
