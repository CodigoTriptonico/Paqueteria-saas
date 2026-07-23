import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { decodeAndSanitizeImage } from "@/lib/security/safe-image";

function fileLike(bytes: Buffer) {
  return {
    size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
}

describe("safe image decoding", () => {
  it("decodes and re-encodes real image bytes as WebP", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#10b981" },
    }).png().toBuffer();
    const result = await decodeAndSanitizeImage(fileLike(png), { maxBytes: 1024 * 1024 });
    assert.equal(result.contentType, "image/webp");
    assert.equal((await sharp(result.bytes).metadata()).format, "webp");
  });

  it("rejects declared-image payloads that are not decodable images", async () => {
    await assert.rejects(
      decodeAndSanitizeImage(fileLike(Buffer.from("<svg><script>alert(1)</script></svg>")), {
        maxBytes: 1024 * 1024,
      }),
      /IMAGE_/,
    );
  });
});
