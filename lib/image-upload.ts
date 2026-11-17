export type SupportedImageExtension = "png" | "jpg" | "webp" | "gif";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Room for the multipart boundaries and field headers around the file in a declared Content-Length.
export const UPLOAD_ENVELOPE_BYTES = 64 * 1024;

// Fixed Russian refusal texts shared by /api/uploads and the editor (UI-SPEC "Поле загрузки в редакторе").
export const uploadRefusal = {
  forbidden: "У вас нет доступа к загрузке.",
  missing: "Файл не выбран.",
  format: "Поддерживаются PNG, JPG, WEBP и GIF.",
  size: "Файл должен быть меньше 4 МБ.",
  signature: "Содержимое файла не соответствует формату изображения.",
  server: "Не удалось загрузить изображение.",
  network: "Нет связи с сервером. Файл не загружен, текущая ссылка сохранена.",
} as const;

export type UploadGateDecision = { status: 503 | 403 | 413; error: string } | null;

// WR-03: decided before request.formData() buffers the body. A failed permission lookup is 503 (retry), never a false 403.
// A missing or non-numeric Content-Length passes; the file.size check after parsing still applies.
export function uploadGate(input: {
  authRetryable: boolean;
  user: unknown;
  access: { canEdit: boolean; openTabs: readonly string[]; unavailable?: true } | null | undefined;
  contentLength: string | null | undefined;
}): UploadGateDecision {
  if (input.authRetryable) return { status: 503, error: uploadRefusal.server };
  if (!input.access || input.access.unavailable) return { status: 503, error: uploadRefusal.server };
  // The owner always has every tab; an editor needs at least one open.
  if (!input.user || !input.access.canEdit || input.access.openTabs.length === 0) {
    return { status: 403, error: uploadRefusal.forbidden };
  }
  const declared = input.contentLength?.trim() ? Number(input.contentLength) : Number.NaN;
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + UPLOAD_ENVELOPE_BYTES) {
    return { status: 413, error: uploadRefusal.size };
  }
  return null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((byte, index) => bytes[index] === byte);

export function imageExtensionFromSignature(bytes: Uint8Array): SupportedImageExtension | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) return "webp";
  return null;
}
