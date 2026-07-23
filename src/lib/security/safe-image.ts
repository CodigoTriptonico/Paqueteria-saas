import sharp from "sharp";

const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_INPUT_PIXELS = 40_000_000;

export type SafeImage = {
  bytes: Buffer;
  contentType: "image/webp";
  extension: "webp";
};

export async function decodeAndSanitizeImage(
  file: Pick<File, "arrayBuffer" | "size">,
  options: { maxBytes: number },
): Promise<SafeImage> {
  if (file.size <= 0 || file.size > options.maxBytes) {
    throw new Error("IMAGE_SIZE_INVALID");
  }
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const decoder = sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    });
    const metadata = await decoder.metadata();
    if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
      throw new Error("IMAGE_FORMAT_INVALID");
    }
    const { data, info } = await decoder
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height || data.length === 0) {
      throw new Error("IMAGE_DECODE_INVALID");
    }
    return { bytes: data, contentType: "image/webp", extension: "webp" };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("IMAGE_")) throw error;
    throw new Error("IMAGE_DECODE_INVALID");
  }
}
