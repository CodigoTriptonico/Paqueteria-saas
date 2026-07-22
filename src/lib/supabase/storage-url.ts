import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function extractStorageObjectPath(bucket: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("://")) {
    return trimmed.replace(/^\/+/, "");
  }

  const publicMarker = `/object/public/${bucket}/`;
  const publicIndex = trimmed.indexOf(publicMarker);
  if (publicIndex >= 0) {
    return trimmed.slice(publicIndex + publicMarker.length);
  }

  const signMarker = `/object/sign/${bucket}/`;
  const signIndex = trimmed.indexOf(signMarker);
  if (signIndex >= 0) {
    return trimmed.slice(signIndex + signMarker.length).split("?")[0] || null;
  }

  return null;
}

/** Reject path traversal and empty/unsafe storage object keys. */
export function isSafeStorageObjectPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) {
    return false;
  }

  if (
    trimmed.startsWith("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    trimmed.includes("//")
  ) {
    return false;
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return false;
  }

  if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("\0")) {
    return false;
  }

  const segments = decoded.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) {
    return false;
  }

  return true;
}

/** True when path is exactly ownerId or under ownerId/. */
export function storagePathOwnedBy(path: string, ownerId: string): boolean {
  const owner = ownerId.trim();
  if (!owner || !isSafeStorageObjectPath(path)) {
    return false;
  }

  return path === owner || path.startsWith(`${owner}/`);
}

export function assertStoragePathOwnedBy(path: string, ownerId: string): string {
  const normalized = path.replace(/^\/+/, "").trim();
  if (!storagePathOwnedBy(normalized, ownerId)) {
    throw new Error("FORBIDDEN_STORAGE_PATH");
  }
  return normalized;
}

export type CreateStorageSignedUrlOptions = {
  expiresInSeconds?: number;
  /** Required owner folder (organizationId or userId for avatars). */
  ownerId?: string;
};

export async function createStorageSignedUrl(
  client: SupabaseClient,
  bucket: string,
  pathOrUrl: string,
  expiresInSecondsOrOptions: number | CreateStorageSignedUrlOptions = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const options: CreateStorageSignedUrlOptions =
    typeof expiresInSecondsOrOptions === "number"
      ? { expiresInSeconds: expiresInSecondsOrOptions }
      : expiresInSecondsOrOptions;

  const path = extractStorageObjectPath(bucket, pathOrUrl);
  if (!path || !isSafeStorageObjectPath(path)) {
    return "";
  }

  if (options.ownerId && !storagePathOwnedBy(path, options.ownerId)) {
    return "";
  }

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, options.expiresInSeconds ?? SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return "";
  }

  return data.signedUrl;
}

export function buildStorageObjectPath(organizationId: string, fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const unique = randomUUID();
  return `${organizationId}/${unique}.${extension}`;
}
