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

export async function createStorageSignedUrl(
  client: SupabaseClient,
  bucket: string,
  pathOrUrl: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const path = extractStorageObjectPath(bucket, pathOrUrl);
  if (!path) {
    return pathOrUrl;
  }

  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return pathOrUrl;
  }

  return data.signedUrl;
}

export function buildStorageObjectPath(organizationId: string, fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const unique = randomUUID();
  return `${organizationId}/${unique}.${extension}`;
}
