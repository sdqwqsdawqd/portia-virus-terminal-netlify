// Editor uploads are shrunk in the browser before they reach /api/uploads: the free storage holds 1 GB, and a phone photo
// of 2–4 MB becomes a few hundred KB as WebP. The server checks stay as they are (size, signature, type); this only
// changes what the browser sends. Any failure sends the original file, so compression can never block an upload.

// Long side of the stored picture. The widest place a picture fills is a maximized window on a high-density screen.
export const COMPRESS_MAX_SIDE = 2048;
export const COMPRESS_QUALITY = 0.85;
// A file this small that already fits the long side is sent untouched: re-encoding would gain little and cost quality.
export const COMPRESS_SKIP_BYTES = 300 * 1024;

const COMPRESSIBLE = new Set(["image/png", "image/jpeg", "image/webp"]);

export type CompressionPlan = { width: number; height: number } | null;

// Pure decision: null means "send the original". GIF is never touched (a canvas keeps only its first frame).
export function compressionPlan(file: { type: string; size: number }, source: { width: number; height: number }): CompressionPlan {
  if (!COMPRESSIBLE.has(file.type)) return null;
  const { width, height } = source;
  if (!(width > 0 && height > 0)) return null;
  const longSide = Math.max(width, height);
  if (longSide <= COMPRESS_MAX_SIDE && file.size <= COMPRESS_SKIP_BYTES) return null;
  const scale = Math.min(1, COMPRESS_MAX_SIDE / longSide);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Pure choice of the result: the encoded blob is used only when it is a real WebP (or JPEG for a JPEG source, where a
// browser cannot encode WebP) and is smaller than the original. A PNG never falls back to JPEG: it would lose transparency.
export function pickEncoded(original: { type: string; size: number }, encoded: { type: string; size: number } | null): "encoded" | "original" {
  if (!encoded || encoded.size === 0 || encoded.size >= original.size) return "original";
  if (encoded.type === "image/webp") return "encoded";
  if (encoded.type === "image/jpeg" && original.type === "image/jpeg") return "encoded";
  return "original";
}

const renamed = (name: string, type: string) => `${name.replace(/\.[^./\\]*$/, "") || "image"}.${type === "image/webp" ? "webp" : "jpg"}`;

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, COMPRESS_QUALITY);
    } catch {
      resolve(null);
    }
  });
}

// Browser only. EXIF rotation is applied by createImageBitmap, so a portrait phone photo stays upright.
export async function compressImageForUpload(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type) || typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const plan = compressionPlan(file, bitmap);
    if (!plan) return file;
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, plan.width, plan.height);
    let blob = await encode(canvas, "image/webp");
    if (blob?.type !== "image/webp" && file.type === "image/jpeg") blob = await encode(canvas, "image/jpeg");
    if (!blob || pickEncoded(file, blob) === "original") return file;
    return new File([blob], renamed(file.name, blob.type), { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
