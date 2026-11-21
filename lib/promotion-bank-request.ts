// Pure checks of a POST /api/promotion/banks request (26.1-17, owner item 14: review items L1-L3). No I/O, so they run without a server.

/** The largest accepted request body, in UTF-8 bytes. Applies to every action, preview and confirm included. */
export const BANK_BODY_LIMIT = 64 * 1024;

const MANUAL_IDS_MAX = 100;
const ID_MAX_LENGTH = 64;

/** L1: true when the raw body text is over the limit. Checked before the JSON is parsed. Cyrillic counts as 2 bytes, like on the wire. */
export function bankBodyTooLarge(text: string): boolean {
  // A text of N UTF-16 units is at most 3N bytes, so the exact count is only needed near the limit.
  if (text.length * 3 <= BANK_BODY_LIMIT) return false;
  return new TextEncoder().encode(text).byteLength > BANK_BODY_LIMIT;
}

/** L1: `manualIds` of a preview. Absent stays `undefined`; an array of up to 100 strings of up to 64 characters passes; anything else is "invalid". */
export function parseManualIds(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MANUAL_IDS_MAX) return "invalid";
  return value.every((id) => typeof id === "string" && id.length <= ID_MAX_LENGTH) ? value as string[] : "invalid";
}

/** L2: the status of a failed counts sync before a confirm. A rights refusal of the RPC (`forbidden` / SQLSTATE 42501) is 403; everything else stays the 409 of a changed bank. */
export function syncFailureStatus(error: { code?: unknown; message?: unknown } | null | undefined): 403 | 409 {
  if (!error) return 409;
  return error.code === "42501" || (typeof error.message === "string" && error.message.trim() === "forbidden") ? 403 : 409;
}

/** L3: the preview secret, or null when it is missing or too short (the reader throws or returns fewer than 32 characters). Never the reason, so nothing about the setup leaks. */
export function previewSecretOrNull(read: () => string): string | null {
  try {
    const secret = read();
    return typeof secret === "string" && secret.length >= 32 ? secret : null;
  } catch {
    return null;
  }
}
