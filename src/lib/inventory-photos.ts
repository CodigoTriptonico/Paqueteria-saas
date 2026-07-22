import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStorageObjectPath,
  createStorageSignedUrl,
  extractStorageObjectPath,
  storagePathOwnedBy,
} from "@/lib/supabase/storage-url";

export const INVENTORY_ITEM_PHOTO_BUCKET = "inventory-item-photos";
const INVENTORY_ITEM_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const INVENTORY_ITEM_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type InventoryPhotoValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateInventoryItemPhoto(
  file: Pick<File, "size" | "type">,
): InventoryPhotoValidationResult {
  if (file.size > INVENTORY_ITEM_PHOTO_MAX_BYTES) {
    return { ok: false, error: "Foto maxima: 4MB" };
  }

  if (
    !INVENTORY_ITEM_PHOTO_TYPES.includes(
      file.type as (typeof INVENTORY_ITEM_PHOTO_TYPES)[number],
    )
  ) {
    return { ok: false, error: "Foto debe ser JPG, PNG o WebP" };
  }

  return { ok: true };
}

export function normalizeInventoryItemPhotoPath(photoUrl: string, organizationId: string) {
  const path =
    extractStorageObjectPath(INVENTORY_ITEM_PHOTO_BUCKET, photoUrl) || photoUrl.trim().replace(/^\/+/, "");
  if (!storagePathOwnedBy(path, organizationId)) {
    return "";
  }
  return path;
}

export async function resolveInventoryItemPhotoUrl(
  client: SupabaseClient | null,
  photoUrl: string | null | undefined,
  organizationId: string,
) {
  if (!photoUrl?.trim()) {
    return "";
  }

  if (!client) {
    return storagePathOwnedBy(
      extractStorageObjectPath(INVENTORY_ITEM_PHOTO_BUCKET, photoUrl) || photoUrl.trim(),
      organizationId,
    )
      ? photoUrl
      : "";
  }

  return createStorageSignedUrl(client, INVENTORY_ITEM_PHOTO_BUCKET, photoUrl, {
    ownerId: organizationId,
  });
}

export function buildInventoryItemPhotoPath(organizationId: string, fileName: string) {
  return buildStorageObjectPath(organizationId, fileName);
}
