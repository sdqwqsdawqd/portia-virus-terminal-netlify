export type SupportedImageExtension = "png" | "jpg" | "webp" | "gif";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

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

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((byte, index) => bytes[index] === byte);

export function imageExtensionFromSignature(bytes: Uint8Array): SupportedImageExtension | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) return "webp";
  return null;
}
